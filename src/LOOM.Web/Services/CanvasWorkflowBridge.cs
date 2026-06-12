using System.Text.Json;
using Loom.Api.Models;
using Microsoft.JSInterop;
namespace LOOM.Web.Services;

public sealed class CanvasWorkflowBridge : IAsyncDisposable
{
    private readonly ILoomApiClient _api;
    private readonly AuthService _auth;
    private readonly ILogger<CanvasWorkflowBridge> _logger;
    private DotNetObjectReference<CanvasWorkflowBridge>? _reference;

    public CanvasWorkflowBridge(ILoomApiClient api, AuthService auth, ILogger<CanvasWorkflowBridge> logger)
    {
        _api = api;
        _auth = auth;
        _logger = logger;
        _api.SessionId = Guid.NewGuid();
    }

    private void EnsureUserContext()
    {
        _api.Username = _auth.CurrentUsername;
    }

    public DotNetObjectReference<CanvasWorkflowBridge> CreateReference()
    {
        _reference ??= DotNetObjectReference.Create(this);
        return _reference;
    }

    [JSInvokable]
    public Task<string> GetSessionIdAsync() => Task.FromResult(_api.SessionId.ToString());

    [JSInvokable]
    public async Task<string> CheckApiHealthAsync()
    {
        var ok = await _api.IsHealthyAsync();
        return ok ? "connected" : "offline";
    }

    [JSInvokable]
    public async Task<string> GetNodeTypesJsonAsync()
    {
        var types = await _api.GetNodeTypesAsync();
        return JsonSerializer.Serialize(types, WebJson.Options);
    }

    [JSInvokable]
    public async Task<string> LoadWorkflowJsonAsync()
    {
        try
        {
            var wf = await _api.GetWorkflowAsync();
            return JsonSerializer.Serialize(wf, WebJson.Options);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Load workflow failed.");
            return JsonSerializer.Serialize(new { error = ex.Message }, WebJson.Options);
        }
    }

    [JSInvokable]
    public async Task<string> ReplaceWorkflowJsonAsync(string workflowJson)
    {
        try
        {
            var dto = JsonSerializer.Deserialize<CanvasWorkflowDto>(workflowJson, WebJson.Options)
                ?? throw new InvalidOperationException("Invalid workflow JSON.");
            dto.SessionId = _api.SessionId;
            var wf = await _api.ReplaceWorkflowAsync(dto);
            return JsonSerializer.Serialize(wf, WebJson.Options);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Replace workflow failed.");
            return JsonSerializer.Serialize(new { error = ex.Message }, WebJson.Options);
        }
    }

    [JSInvokable]
    public async Task<string> AddNodeAsync(string type, double x, double y)
        => await MutateAsync(() => _api.AddNodeAsync(type, x, y));

    [JSInvokable]
    public async Task<string> UpdateNodeAsync(string clientNodeId, double x, double y, string? fieldsJson)
    {
        Dictionary<string, string>? fields = null;
        if (!string.IsNullOrEmpty(fieldsJson))
            fields = JsonSerializer.Deserialize<Dictionary<string, string>>(fieldsJson, WebJson.Options);
        return await MutateAsync(() => _api.UpdateNodeAsync(clientNodeId, x, y, fields));
    }

    [JSInvokable]
    public async Task<string> DeleteNodeAsync(string clientNodeId)
        => await MutateAsync(() => _api.DeleteNodeAsync(clientNodeId));

    [JSInvokable]
    public async Task<string> ValidateConnectionAsync(string fromId, string toId, string fromPort, string toPort)
    {
        try
        {
            var result = await _api.ValidateConnectionAsync(fromId, toId, fromPort, toPort);
            return JsonSerializer.Serialize(result, WebJson.Options);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new ConnectionValidationResultDto
            {
                Valid = false,
                Error = ex.Message
            }, WebJson.Options);
        }
    }

    [JSInvokable]
    public async Task<string> ConnectNodesAsync(string fromId, string toId, string fromPort, string toPort)
        => await MutateAsync(() => _api.ConnectNodesAsync(fromId, toId, fromPort, toPort));

    [JSInvokable]
    public async Task<string> DisconnectEdgeAsync(string edgeId)
        => await MutateAsync(() => _api.DisconnectEdgeAsync(edgeId));

    [JSInvokable]
    public async Task<string> ExecuteWorkflowAsync()
    {
        try
        {
            var result = await _api.ExecuteWorkflowAsync();
            return JsonSerializer.Serialize(result, WebJson.Options);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Execute failed.");
            return JsonSerializer.Serialize(new WorkflowExecutionResponseDto { Success = false, Error = ex.Message }, WebJson.Options);
        }
    }

    [JSInvokable]
    public async Task<string> ExportCSharpAsync()
    {
        try
        {
            var result = await _api.ExportCSharpAsync();
            return JsonSerializer.Serialize(result, WebJson.Options);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Export failed.");
            return JsonSerializer.Serialize(new { error = ex.Message }, WebJson.Options);
        }
    }

    [JSInvokable]
    public async Task<string> SaveWorkflowAsync(string path)
    {
        EnsureUserContext();
        try
        {
            var saved = await _api.SaveWorkflowAsync(path);
            return JsonSerializer.Serialize(new { saved, path }, WebJson.Options);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { saved = false, error = ex.Message }, WebJson.Options);
        }
    }

    [JSInvokable]
    public async Task<string> ListSavedWorkflowsJsonAsync()
    {
        EnsureUserContext();
        try
        {
            var paths = await _api.ListSavedWorkflowsAsync();
            return JsonSerializer.Serialize(paths, WebJson.Options);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "List saved workflows failed.");
            return JsonSerializer.Serialize(new { error = ex.Message }, WebJson.Options);
        }
    }

    [JSInvokable]
    public async Task<string> LoadWorkflowFromPathAsync(string path)
    {
        EnsureUserContext();
        try
        {
            var wf = await _api.LoadWorkflowFromPathAsync(path);
            return JsonSerializer.Serialize(wf, WebJson.Options);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Load workflow from path failed.");
            return JsonSerializer.Serialize(new { error = ex.Message }, WebJson.Options);
        }
    }

    [JSInvokable]
    public async Task<string> DeleteSavedWorkflowAsync(string path)
    {
        EnsureUserContext();
        try
        {
            var deleted = await _api.DeleteSavedWorkflowAsync(path);
            return JsonSerializer.Serialize(new { deleted, path }, WebJson.Options);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Delete saved workflow failed.");
            return JsonSerializer.Serialize(new { deleted = false, error = ex.Message }, WebJson.Options);
        }
    }

    private async Task<string> MutateAsync(Func<Task<CanvasWorkflowDto>> action)
    {
        try
        {
            var wf = await action();
            return JsonSerializer.Serialize(wf, WebJson.Options);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Graph mutation failed.");
            return JsonSerializer.Serialize(new { error = ex.Message }, WebJson.Options);
        }
    }

    public ValueTask DisposeAsync()
    {
        _reference?.Dispose();
        return ValueTask.CompletedTask;
    }
}
