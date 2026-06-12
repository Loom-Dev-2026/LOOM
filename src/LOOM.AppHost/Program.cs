using System.Diagnostics;

var solutionRoot = FindSolutionRoot();
var webProject = Path.Combine(solutionRoot, "src", "LOOM.Web", "LOOM.Web.csproj");

if (!File.Exists(webProject))
{
    Console.Error.WriteLine("Could not find LOOM.Web.csproj at: " + webProject);
    return 1;
}

Console.WriteLine();
Console.WriteLine("  LOOM — starting integrated application");
Console.WriteLine("  (Blazor UI + C# workflow engine in one process)");
Console.WriteLine();
Console.WriteLine("  UI:     http://localhost:5280");
Console.WriteLine("  Canvas: http://localhost:5280/canvas");
Console.WriteLine("  API:    http://localhost:5280/api/health");
Console.WriteLine();
Console.WriteLine("  Press Ctrl+C to stop.");
Console.WriteLine();

var startInfo = new ProcessStartInfo
{
    FileName = "dotnet",
    Arguments = $"run --project \"{webProject}\" --launch-profile loom",
    WorkingDirectory = solutionRoot,
    UseShellExecute = false,
};

using var process = Process.Start(startInfo);
if (process is null)
{
    Console.Error.WriteLine("Failed to start LOOM.Web.");
    return 1;
}

// AppHost is a console launcher — open the canvas once the web app is listening.
_ = Task.Run(async () =>
{
    for (var i = 0; i < 40; i++)
    {
        await Task.Delay(500);
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
            if ((await client.GetAsync("http://localhost:5280/api/health")).IsSuccessStatusCode)
            {
                Process.Start(new ProcessStartInfo("http://localhost:5280/canvas")
                {
                    UseShellExecute = true
                });
                return;
            }
        }
        catch
        {
            /* retry until LOOM.Web is up */
        }
    }
});

process.WaitForExit();
return process.ExitCode;

static string FindSolutionRoot()
{
    var dir = new DirectoryInfo(AppContext.BaseDirectory);
    while (dir is not null)
    {
        if (File.Exists(Path.Combine(dir.FullName, "LOOM.sln")))
            return dir.FullName;
        dir = dir.Parent;
    }

    // Development: walk from project folder
    dir = new DirectoryInfo(Directory.GetCurrentDirectory());
    while (dir is not null)
    {
        if (File.Exists(Path.Combine(dir.FullName, "LOOM.sln")))
            return dir.FullName;
        dir = dir.Parent;
    }

    throw new InvalidOperationException("LOOM.sln not found. Run from the solution directory.");
}
