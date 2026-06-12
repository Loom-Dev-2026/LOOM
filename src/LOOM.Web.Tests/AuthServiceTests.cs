using LOOM.Web.Data;
using LOOM.Web.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace LOOM.Web.Tests;

public sealed class AuthServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly AuthDbContext _db;
    private readonly AuthService _service;

    public AuthServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var opts = new DbContextOptionsBuilder<AuthDbContext>()
            .UseSqlite(_connection)
            .Options;

        _db = new AuthDbContext(opts);
        _service = new AuthService(_db, NullLogger<AuthService>.Instance);
    }

    [Fact]
    public async Task Register_success()
    {
        var (success, error) = await _service.TryRegisterAsync("newuser", "new@test.com", "Secret123!");
        Assert.True(success);
        Assert.Empty(error);
    }

    [Fact]
    public async Task Register_duplicate_username_fails()
    {
        await _service.TryRegisterAsync("dup", "a@test.com", "Secret123!");
        var (success, error) = await _service.TryRegisterAsync("dup", "b@test.com", "Other456!");
        Assert.False(success);
        Assert.Contains("already taken", error);
    }

    [Fact]
    public async Task Register_duplicate_email_fails()
    {
        await _service.TryRegisterAsync("user1", "same@test.com", "Secret123!");
        var (success, error) = await _service.TryRegisterAsync("user2", "same@test.com", "Other456!");
        Assert.False(success);
        Assert.Contains("already", error);
    }

    [Theory]
    [InlineData("ab", "x@y.com", "123456", "Username must be at least 3")]
    [InlineData("valid", "", "123456", "valid email")]
    [InlineData("valid", "bademail", "123456", "valid email")]
    [InlineData("valid", "x@y.com", "12345", "Password must be at least 6")]
    [InlineData("", "x@y.com", "123456", "Username must be at least 3")]
    public async Task Register_validation_fails(string username, string email, string password, string expected)
    {
        var (success, error) = await _service.TryRegisterAsync(username, email, password);
        Assert.False(success);
        Assert.Contains(expected, error);
    }

    [Fact]
    public async Task Login_by_email_success()
    {
        // "demo"/"demo@loom.test" is seeded by AuthService
        var (success, username, error) = await _service.TryLoginAsync("demo@loom.test", "Demo123!");
        Assert.True(success);
        Assert.Equal("demo", username);
        Assert.Empty(error);
    }

    [Fact]
    public async Task Login_by_username_success()
    {
        await _service.TryRegisterAsync("alice", "alice@test.com", "Pass123!");
        var (success, username, error) = await _service.TryLoginAsync("alice", "Pass123!");
        Assert.True(success);
        Assert.Equal("alice", username);
    }

    [Fact]
    public async Task Login_wrong_password_fails()
    {
        await _service.TryRegisterAsync("bob", "bob@test.com", "Correct1!");
        var (success, username, error) = await _service.TryLoginAsync("bob@test.com", "WrongPass!");
        Assert.False(success);
        Assert.Null(username);
        Assert.Contains("Invalid", error);
    }

    [Fact]
    public async Task Login_nonexistent_user_fails()
    {
        var (success, username, error) = await _service.TryLoginAsync("nobody", "Anything1!");
        Assert.False(success);
        Assert.Null(username);
    }

    [Fact]
    public void SetCurrentUser_and_IsLoggedIn()
    {
        Assert.False(_service.IsLoggedIn);
        Assert.Null(_service.CurrentUsername);

        _service.SetCurrentUser("alice");
        Assert.True(_service.IsLoggedIn);
        Assert.Equal("alice", _service.CurrentUsername);

        _service.ClearCurrentUser();
        Assert.False(_service.IsLoggedIn);
        Assert.Null(_service.CurrentUsername);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }
}
