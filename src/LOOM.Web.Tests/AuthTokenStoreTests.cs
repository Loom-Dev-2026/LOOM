using LOOM.Web.Services;

namespace LOOM.Web.Tests;

public sealed class AuthTokenStoreTests
{
    [Fact]
    public void Generate_returns_non_empty_token()
    {
        var store = new AuthTokenStore();
        var token = store.Generate("alice");
        Assert.False(string.IsNullOrWhiteSpace(token));
    }

    [Fact]
    public void Generate_returns_unique_tokens()
    {
        var store = new AuthTokenStore();
        var t1 = store.Generate("alice");
        var t2 = store.Generate("bob");
        Assert.NotEqual(t1, t2);
    }

    [Fact]
    public void Consume_valid_token_returns_username()
    {
        var store = new AuthTokenStore();
        var token = store.Generate("alice");
        var username = store.Consume(token);
        Assert.Equal("alice", username);
    }

    [Fact]
    public void Consume_double_consumption_returns_null()
    {
        var store = new AuthTokenStore();
        var token = store.Generate("alice");
        store.Consume(token); // first
        var result = store.Consume(token); // second
        Assert.Null(result);
    }

    [Fact]
    public void Consume_invalid_token_returns_null()
    {
        var store = new AuthTokenStore();
        var result = store.Consume("no-such-token");
        Assert.Null(result);
    }

    [Fact]
    public void Consume_expired_token_returns_null()
    {
        var store = new AuthTokenStore();
        var token = store.Generate("alice");

        // force expiration by reflection
        var field = typeof(AuthTokenStore)
            .GetField("_tokens", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);

        if (field?.GetValue(store) is System.Collections.Concurrent.ConcurrentDictionary<string, (string Username, DateTime Expires)> dict
            && dict.TryGetValue(token, out var entry))
        {
            dict[token] = (entry.Username, DateTime.UtcNow.AddMinutes(-1));
        }

        var result = store.Consume(token);
        Assert.Null(result);
    }

    [Fact]
    public void Concurrent_access_does_not_throw()
    {
        var store = new AuthTokenStore();
        var tokens = new List<string>();
        for (int i = 0; i < 100; i++)
            tokens.Add(store.Generate($"user{i}"));

        var results = new System.Collections.Concurrent.ConcurrentBag<string?>();

        Parallel.ForEach(tokens, token =>
        {
            var u = store.Consume(token);
            results.Add(u);
        });

        Assert.Equal(100, results.Count(r => r is not null));
        Assert.Equal(0, results.Count(r => r is null)); // all consumed once
    }
}
