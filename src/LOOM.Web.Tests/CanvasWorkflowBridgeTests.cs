using System.Text.Json;
using Loom.Api;
using Loom.Services;
using LOOM.Web.Data;
using LOOM.Web.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace LOOM.Web.Tests;

public sealed class CanvasWorkflowBridgeTests : IAsyncDisposable
{
    private readonly string _tempDir;
    private readonly CanvasWorkflowBridge _bridge;
    private readonly AuthDbContext _db;
    private readonly SqliteConnection _connection;
    private readonly ServiceProvider _serviceProvider;

    public CanvasWorkflowBridgeTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), "LOOM_BridgeTest_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_tempDir);

        var storage = new DataStorage(_tempDir);
        var sessionStore = new WorkflowSessionStore(storage);

        var services = new ServiceCollection();
        services.AddLogging();
        _serviceProvider = services.BuildServiceProvider();

        var factory = new NodeFactory(_serviceProvider);
        var nodeManager = new NodeManager(factory);
        var engine = new ExecutionEngine(nodeManager, storage);
        var graphService = new WorkflowGraphService(sessionStore, factory, nodeManager, engine, storage);
        var apiService = new WorkflowApiService();
        var loomApi = new InProcessLoomApiClient(graphService, apiService);

        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var opts = new DbContextOptionsBuilder<AuthDbContext>()
            .UseSqlite(_connection)
            .Options;
        _db = new AuthDbContext(opts);
        var auth = new AuthService(_db, NullLogger<AuthService>.Instance);

        _bridge = new CanvasWorkflowBridge(loomApi, auth, NullLogger<CanvasWorkflowBridge>.Instance);
    }

    [Fact]
    public async Task CheckApiHealthAsync_returns_connected()
    {
        var result = await _bridge.CheckApiHealthAsync();
        Assert.Equal("connected", result);
    }

    [Fact]
    public async Task LoadWorkflowJsonAsync_returns_valid_graph()
    {
        var json = await _bridge.LoadWorkflowJsonAsync();
        var doc = JsonDocument.Parse(json);
        Assert.True(doc.RootElement.TryGetProperty("nodes", out _));
        Assert.True(doc.RootElement.TryGetProperty("edges", out _));
    }

    [Fact]
    public async Task AddNodeAsync_adds_node()
    {
        var result = await _bridge.AddNodeAsync("NumberInput", 100, 200);
        var doc = JsonDocument.Parse(result);
        var nodes = doc.RootElement.GetProperty("nodes");
        Assert.True(nodes.GetArrayLength() > 0);
        Assert.Equal("NumberInput", nodes[0].GetProperty("type").GetString());
    }

    [Fact]
    public async Task SaveWorkflowAsync_persists_file()
    {
        var path = Path.Combine(_tempDir, "savetest.loom");
        var result = await _bridge.SaveWorkflowAsync(path);
        var doc = JsonDocument.Parse(result);
        Assert.True(doc.RootElement.GetProperty("saved").GetBoolean());
        Assert.True(File.Exists(path));
    }

    [Fact]
    public async Task ListSavedWorkflowsJsonAsync_returns_saved()
    {
        var path = Path.Combine(_tempDir, "listtest.loom");
        await _bridge.SaveWorkflowAsync(path);

        var json = await _bridge.ListSavedWorkflowsJsonAsync();
        var doc = JsonDocument.Parse(json);
        var arr = doc.RootElement;
        Assert.True(arr.GetArrayLength() > 0);
    }

    [Fact]
    public async Task Connect_and_disconnect_roundtrip()
    {
        var first = await _bridge.AddNodeAsync("NumberInput", 100, 100);
        var firstDoc = JsonDocument.Parse(first);
        var firstId = firstDoc.RootElement.GetProperty("nodes")[0].GetProperty("id").GetString();

        var second = await _bridge.AddNodeAsync("Result", 400, 100);
        var secondDoc = JsonDocument.Parse(second);
        var secondId = secondDoc.RootElement.GetProperty("nodes")[1].GetProperty("id").GetString();

        var connectResult = await _bridge.ConnectNodesAsync(firstId!, secondId!, "Value", "Value");
        var connectDoc = JsonDocument.Parse(connectResult);
        var edges = connectDoc.RootElement.GetProperty("edges");
        Assert.True(edges.GetArrayLength() > 0);

        var edgeId = edges[0].GetProperty("id").GetString();
        var disconnectResult = await _bridge.DisconnectEdgeAsync(edgeId!);
        var disconnectDoc = JsonDocument.Parse(disconnectResult);
        Assert.Equal(0, disconnectDoc.RootElement.GetProperty("edges").GetArrayLength());
    }

    [Fact]
    public async Task ExecuteWorkflowAsync_simple_graph()
    {
        await _bridge.AddNodeAsync("NumberInput", 100, 100);
        var second = await _bridge.AddNodeAsync("Result", 400, 100);
        var doc = JsonDocument.Parse(second);
        var nodes = doc.RootElement.GetProperty("nodes");
        var firstId = nodes[0].GetProperty("id").GetString();
        var secondId = nodes[1].GetProperty("id").GetString();
        await _bridge.ConnectNodesAsync(firstId!, secondId!, "Value", "Value");

        var result = await _bridge.ExecuteWorkflowAsync();
        var resultDoc = JsonDocument.Parse(result);
        Assert.True(resultDoc.RootElement.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task ExportCSharpAsync_returns_code()
    {
        await _bridge.AddNodeAsync("NumberInput", 100, 100);
        var second = await _bridge.AddNodeAsync("Result", 400, 100);
        var doc = JsonDocument.Parse(second);
        var nodes = doc.RootElement.GetProperty("nodes");
        var firstId = nodes[0].GetProperty("id").GetString();
        var secondId = nodes[1].GetProperty("id").GetString();
        await _bridge.ConnectNodesAsync(firstId!, secondId!, "Value", "Value");

        var result = await _bridge.ExportCSharpAsync();
        var resultDoc = JsonDocument.Parse(result);
        Assert.True(resultDoc.RootElement.TryGetProperty("sourceCode", out _));
    }

    [Fact]
    public async Task ReplaceWorkflowJsonAsync_bad_json_returns_error()
    {
        var result = await _bridge.ReplaceWorkflowJsonAsync("{bad json}");
        var doc = JsonDocument.Parse(result);
        Assert.True(doc.RootElement.TryGetProperty("error", out _));
    }

    public async ValueTask DisposeAsync()
    {
        await _bridge.DisposeAsync();
        _db.Dispose();
        _connection.Dispose();
        _serviceProvider.Dispose();
        try { Directory.Delete(_tempDir, true); } catch { }
    }
}
