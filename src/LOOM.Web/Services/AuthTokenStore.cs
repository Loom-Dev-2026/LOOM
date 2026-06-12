using System.Collections.Concurrent;

namespace LOOM.Web.Services;

public sealed class AuthTokenStore
{
    private readonly ConcurrentDictionary<string, (string Username, DateTime Expires)> _tokens = new();

    public string Generate(string username)
    {
        var token = Guid.NewGuid().ToString("N");
        _tokens[token] = (username, DateTime.UtcNow.AddMinutes(5));
        return token;
    }

    public string? Consume(string token)
    {
        if (_tokens.TryRemove(token, out var entry))
        {
            if (entry.Expires > DateTime.UtcNow)
                return entry.Username;
        }
        return null;
    }
}
