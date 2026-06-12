namespace LOOM.Web.Options;

public sealed class LoomApiOptions
{
    public const string SectionName = "LoomApi";

    /// <summary>
    /// InProcess: Loom C# services run inside LOOM.Web (default, single command).
    /// Remote: HTTP calls to a separate LoomBackend instance.
    /// </summary>
    public string Mode { get; set; } = "InProcess";

    public string BaseUrl { get; set; } = "http://localhost:5201";

    public bool UseInProcess =>
        string.Equals(Mode, "InProcess", StringComparison.OrdinalIgnoreCase);
}
