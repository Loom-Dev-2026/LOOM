using System.Security.Claims;
using System.Net.Http.Headers;
using System.Text.Json;
using Loom.Api;
using Loom.Infrastructure;
using LOOM.Web.Components;
using LOOM.Web.Data;
using LOOM.Web.Options;
using LOOM.Web.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var loomApiOptions = builder.Configuration
    .GetSection(LoomApiOptions.SectionName)
    .Get<LoomApiOptions>() ?? new LoomApiOptions();

builder.Services.Configure<LoomApiOptions>(
    builder.Configuration.GetSection(LoomApiOptions.SectionName));

builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

var authDbPath = Path.Combine(builder.Environment.ContentRootPath, "Data", "loom.db");
Directory.CreateDirectory(Path.GetDirectoryName(authDbPath)!);
builder.Services.AddDbContext<AuthDbContext>(options =>
    options.UseSqlite($"Data Source={authDbPath}"));

if (loomApiOptions.UseInProcess)
{
    builder.Services.AddLoomServices(builder.Configuration);
    builder.Services.AddScoped<ILoomApiClient, InProcessLoomApiClient>();
}
else
{
    builder.Services.AddHttpClient<ILoomApiClient, RemoteLoomApiClient>();
}

builder.Services.AddScoped<CanvasWorkflowBridge>();
builder.Services.AddSingleton<ThemeService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddSingleton<AuthTokenStore>();
builder.Services.AddHttpContextAccessor();

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "loom-auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
        options.SlidingExpiration = true;
        options.LoginPath = "/";
    })
    .AddGoogle(options =>
    {
        options.ClientId = builder.Configuration["Google:ClientId"] ?? "";
        options.ClientSecret = builder.Configuration["Google:ClientSecret"] ?? "";
        options.CallbackPath = "/signin-google";
        options.Scope.Add("email");
        options.Scope.Add("profile");
        options.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.Events.OnCreatingTicket = async ctx =>
        {
            var email = ctx.Identity?.FindFirst(ClaimTypes.Email)?.Value;
            var displayName = ctx.Identity?.FindFirst(ClaimTypes.Name)?.Value;
            if (string.IsNullOrEmpty(email)) return;

            var authService = ctx.HttpContext.RequestServices.GetRequiredService<AuthService>();
            var username = await authService.FindOrCreateByGoogleAsync(email, displayName);
            if (username is not null)
            {
                ctx.Identity?.AddClaim(new Claim(ClaimTypes.Name, username));
                ctx.Identity?.AddClaim(new Claim("auth_method", "google"));
            }
        };
    })
    .AddOAuth("GitHub", options =>
    {
        options.ClientId = builder.Configuration["GitHub:ClientId"] ?? "";
        options.ClientSecret = builder.Configuration["GitHub:ClientSecret"] ?? "";
        options.CallbackPath = "/signin-github";
        options.AuthorizationEndpoint = "https://github.com/login/oauth/authorize";
        options.TokenEndpoint = "https://github.com/login/oauth/access_token";
        options.UserInformationEndpoint = "https://api.github.com/user";
        options.Scope.Add("read:user");
        options.Scope.Add("user:email");
        options.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.ClaimsIssuer = "GitHub";
        options.SaveTokens = true;
        options.Events.OnCreatingTicket = async ctx =>
        {
            var request = new HttpRequestMessage(HttpMethod.Get, ctx.Options.UserInformationEndpoint);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ctx.AccessToken);
            var response = await ctx.Backchannel.SendAsync(request, ctx.HttpContext.RequestAborted);
            response.EnsureSuccessStatusCode();
            var userJson = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var login = userJson.RootElement.GetProperty("login").GetString();
            var userId = userJson.RootElement.GetProperty("id").GetInt64();

            if (string.IsNullOrEmpty(login)) return;

            string? email = null;
            try
            {
                var emailReq = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/user/emails");
                emailReq.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                emailReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ctx.AccessToken);
                var emailResp = await ctx.Backchannel.SendAsync(emailReq, ctx.HttpContext.RequestAborted);
                emailResp.EnsureSuccessStatusCode();
                var emailsJson = JsonDocument.Parse(await emailResp.Content.ReadAsStringAsync());
                foreach (var entry in emailsJson.RootElement.EnumerateArray())
                {
                    if (entry.GetProperty("primary").GetBoolean())
                    {
                        email = entry.GetProperty("email").GetString();
                        if (entry.GetProperty("verified").GetBoolean())
                            break;
                    }
                }
            }
            catch { /* email not critical */ }

            var authService = ctx.HttpContext.RequestServices.GetRequiredService<AuthService>();
            var username = await authService.FindOrCreateByGitHubAsync(login, email);
            if (username is not null)
            {
                ctx.Identity?.AddClaim(new Claim(ClaimTypes.Name, username));
                ctx.Identity?.AddClaim(new Claim("auth_method", "github"));
                ctx.Identity?.AddClaim(new Claim(ClaimTypes.NameIdentifier, userId.ToString()));
            }
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.UseAntiforgery();

if (loomApiOptions.UseInProcess)
    app.MapWorkflowApi();

app.MapGet("/api/auth/apply", async (
    HttpContext httpContext,
    [FromQuery] string token,
    AuthTokenStore tokenStore) =>
{
    var username = tokenStore.Consume(token);
    if (username is null)
        return Results.Redirect("/?error=invalid_token");

    var claims = new List<Claim>
    {
        new(ClaimTypes.Name, username),
    };
    var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
    var principal = new ClaimsPrincipal(identity);

    await httpContext.SignInAsync(
        CookieAuthenticationDefaults.AuthenticationScheme,
        principal,
        new AuthenticationProperties
        {
            IsPersistent = true,
            ExpiresUtc = DateTimeOffset.UtcNow.AddDays(7),
        });

    return Results.Redirect("/canvas");
});

app.MapGet("/api/auth/logout", async (HttpContext httpContext) =>
{
    await httpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    httpContext.Response.Cookies.Delete("loom-auth");
    httpContext.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
    return Results.Redirect("/");
});

app.MapGet("/api/auth/google-login", async (HttpContext httpContext) =>
{
    var props = new AuthenticationProperties
    {
        RedirectUri = "/canvas"
    };
    await httpContext.ChallengeAsync(GoogleDefaults.AuthenticationScheme, props);
});

app.MapGet("/api/auth/github-login", async (HttpContext httpContext) =>
{
    var props = new AuthenticationProperties
    {
        RedirectUri = "/canvas"
    };
    await httpContext.ChallengeAsync("GitHub", props);
});

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
