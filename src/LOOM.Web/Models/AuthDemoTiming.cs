namespace LOOM.Web.Models;

/// <summary>Configurable delays (ms) for each phase of the auth demo loop.</summary>
public sealed class AuthDemoTiming
{
    public int EmptyHold { get; init; } = 500;
    public int InputSlide { get; init; } = 750;
    public int OutputSlide { get; init; } = 750;
    public int EdgeDraw { get; init; } = 900;
    public int LinkGlow { get; init; } = 600;
    public int CursorMove { get; init; } = 700;
    public int RunPress { get; init; } = 350;
    public int InputExecute { get; init; } = 650;
    public int InputSuccess { get; init; } = 400;
    public int EdgePulse { get; init; } = 550;
    public int OutputExecute { get; init; } = 650;
    public int OutputSuccess { get; init; } = 500;
    public int ToCode { get; init; } = 800;
    public int CodeLine { get; init; } = 280;
    public int CodeHold { get; init; } = 2800;
    public int ResetFade { get; init; } = 700;
}
