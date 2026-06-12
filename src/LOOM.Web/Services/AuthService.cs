using System.Security.Cryptography;
using System.Text;
using LOOM.Web.Data;
using LOOM.Web.Models;
using Microsoft.EntityFrameworkCore;

namespace LOOM.Web.Services;

public sealed class AuthService
{
    private readonly AuthDbContext _db;
    private readonly ILogger<AuthService> _logger;
    private string? _currentUsername;
    private readonly object _seedLock = new();
    private bool _seeded;

    public string? CurrentUsername => _currentUsername;
    public bool IsLoggedIn => !string.IsNullOrEmpty(_currentUsername);

    public AuthService(AuthDbContext db, ILogger<AuthService> logger)
    {
        _db = db;
        _logger = logger;
        EnsureSeeded();
    }

    public async Task<(bool Success, string Error)> TryRegisterAsync(string username, string email, string password)
    {
        if (string.IsNullOrWhiteSpace(username) || username.Length < 3)
        {
            return (false, "Username must be at least 3 characters.");
        }

        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
        {
            return (false, "Enter a valid email address.");
        }

        if (string.IsNullOrWhiteSpace(password) || password.Length < 6)
        {
            return (false, "Password must be at least 6 characters.");
        }

        try
        {
            if (await _db.Users.AnyAsync(u => u.Username == username))
            {
                return (false, "Username is already taken.");
            }

            if (await _db.Users.AnyAsync(u => u.Email == email))
            {
                return (false, "Email is already registered.");
            }

            var user = new AuthUser
            {
                Username = username,
                Email = email,
                PasswordHash = HashPassword(password),
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();
            return (true, string.Empty);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Registration failed for {Username}", username);
            return (false, "An unexpected error occurred. Please try again.");
        }
    }

    public async Task<(bool Success, string? Username, string Error)> TryLoginAsync(string emailOrUsername, string password)
    {
        try
        {
            AuthUser? found;

            if (emailOrUsername.Contains('@'))
            {
                found = await _db.Users.FirstOrDefaultAsync(u => u.Email == emailOrUsername);
            }
            else
            {
                found = await _db.Users.FirstOrDefaultAsync(u => u.Username == emailOrUsername);
            }

            if (found is null)
            {
                return (false, null, "Invalid email or password.");
            }

            if (found.PasswordHash != HashPassword(password))
            {
                return (false, null, "Invalid email or password.");
            }

            return (true, found.Username, string.Empty);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Login failed for {EmailOrUsername}", emailOrUsername);
            return (false, null, "An unexpected error occurred. Please try again.");
        }
    }

    public void SetCurrentUser(string username)
    {
        _currentUsername = username;
    }

    public void ClearCurrentUser()
    {
        _currentUsername = null;
    }

    public async Task<string?> FindOrCreateByGitHubAsync(string githubUsername, string? email)
    {
        if (string.IsNullOrWhiteSpace(githubUsername)) return null;

        var existing = await _db.Users.FirstOrDefaultAsync(u => u.Username == githubUsername);
        if (existing is not null)
            return existing.Username;

        if (!string.IsNullOrWhiteSpace(email))
        {
            var byEmail = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (byEmail is not null)
                return byEmail.Username;
        }

        var username = githubUsername;
        var suffix = 1;
        while (await _db.Users.AnyAsync(u => u.Username == username))
        {
            username = $"{githubUsername}{suffix}";
            suffix++;
        }

        var user = new AuthUser
        {
            Username = username,
            Email = email ?? $"{username}@github.oauth",
            PasswordHash = Convert.ToHexString(Guid.NewGuid().ToByteArray()),
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return username;
    }

    public async Task<string?> FindOrCreateByGoogleAsync(string email, string? displayName)
    {
        if (string.IsNullOrWhiteSpace(email)) return null;

        var existing = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (existing is not null)
            return existing.Username;

        var baseName = email.Split('@')[0]
            .Replace(".", "").Replace("_", "").Replace("-", "");
        if (baseName.Length < 3) baseName = "user" + baseName;

        var username = baseName;
        var suffix = 1;
        while (await _db.Users.AnyAsync(u => u.Username == username))
        {
            username = $"{baseName}{suffix}";
            suffix++;
        }

        var user = new AuthUser
        {
            Username = username,
            Email = email,
            PasswordHash = Convert.ToHexString(Guid.NewGuid().ToByteArray()),
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return username;
    }

    private void EnsureSeeded()
    {
        if (_seeded) return;
        lock (_seedLock)
        {
            if (_seeded) return;
            try
            {
                _db.Database.EnsureCreated();
                if (!_db.Users.Any())
                {
                    SeedUsers();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not seed auth database (may already exist or be locked)");
            }
            _seeded = true;
        }
    }

    private void SeedUsers()
    {
        var seedUsers = new[]
        {
            ("demo", "demo@loom.test", "Demo123!"),
            ("admin", "admin@loom.test", "Admin123!"),
        };

        foreach (var (username, email, password) in seedUsers)
        {
            _db.Users.Add(new AuthUser
            {
                Username = username,
                Email = email,
                PasswordHash = HashPassword(password),
            });
        }
        _db.SaveChanges();
    }

    private static string HashPassword(string password)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(password));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
