namespace LOOM.Web.Services;

public sealed class ThemeService
{
    public string CurrentTheme { get; private set; } = "dark";

    public event Action? OnChanged;

    public void SetTheme(string theme)
    {
        if (theme is not ("dark" or "light"))
            theme = "dark";

        CurrentTheme = theme;
        OnChanged?.Invoke();
    }

    public void Toggle()
    {
        SetTheme(CurrentTheme == "dark" ? "light" : "dark");
    }
}
