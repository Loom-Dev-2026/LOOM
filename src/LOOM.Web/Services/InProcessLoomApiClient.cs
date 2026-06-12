using Loom.Api;
using Loom.Api.Models;
using Loom.Services;

namespace LOOM.Web.Services;

public sealed class InProcessLoomApiClient : ILoomApiClient
{
    private readonly WorkflowGraphService _graph;
    private readonly WorkflowApiService _api;

    public Guid SessionId { get; set; }
    public string? Username { get; set; }

    public InProcessLoomApiClient(WorkflowGraphService graph, WorkflowApiService api)
    {
        _graph = graph;
        _api = api;
    }

    public Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(true);

    public Task<IReadOnlyList<NodeTypeDefinitionDto>> GetNodeTypesAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(_api.GetNodeTypes());

    public Task<CanvasWorkflowDto> GetWorkflowAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(_graph.GetWorkflow(SessionId));

    public Task<CanvasWorkflowDto> ReplaceWorkflowAsync(CanvasWorkflowDto workflow, CancellationToken cancellationToken = default)
        => _graph.ReplaceWorkflowAsync(SessionId, workflow);

    public Task<CanvasWorkflowDto> AddNodeAsync(string type, double x, double y, CancellationToken cancellationToken = default)
        => _graph.AddNodeAsync(SessionId, type, x, y);

    public Task<CanvasWorkflowDto> UpdateNodeAsync(string clientNodeId, double? x, double? y, Dictionary<string, string>? fields, CancellationToken cancellationToken = default)
        => _graph.UpdateNodeAsync(SessionId, clientNodeId, x, y, fields);

    public Task<CanvasWorkflowDto> DeleteNodeAsync(string clientNodeId, CancellationToken cancellationToken = default)
        => _graph.DeleteNodeAsync(SessionId, clientNodeId);

    public Task<ConnectionValidationResultDto> ValidateConnectionAsync(
        string fromClientId, string toClientId, string fromPort, string toPort,
        CancellationToken cancellationToken = default)
        => Task.FromResult(_graph.ValidateConnection(SessionId, fromClientId, toClientId, fromPort, toPort));

    public Task<CanvasWorkflowDto> ConnectNodesAsync(
        string fromClientId, string toClientId, string fromPort, string toPort,
        CancellationToken cancellationToken = default)
        => _graph.ConnectNodesAsync(SessionId, fromClientId, toClientId, fromPort, toPort);

    public Task<CanvasWorkflowDto> DisconnectEdgeAsync(string edgeClientId, CancellationToken cancellationToken = default)
        => _graph.DisconnectEdgeAsync(SessionId, edgeClientId);

    public async Task<WorkflowExecutionResponseDto> ExecuteWorkflowAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return await _graph.ExecuteAsync(SessionId);
    }

    public Task<ExportCSharpResponseDto> ExportCSharpAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(_graph.ExportCSharp(SessionId));

    public Task<bool> SaveWorkflowAsync(string path, CancellationToken cancellationToken = default)
        => _graph.SaveToPathAsync(SessionId, path, Username);

    public Task<IReadOnlyList<string>> ListSavedWorkflowsAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(_graph.ListSavedWorkflows(Username));

    public Task<CanvasWorkflowDto> LoadWorkflowFromPathAsync(string path, CancellationToken cancellationToken = default)
        => _graph.LoadFromPathAsync(SessionId, path, Username);

    public Task<bool> DeleteSavedWorkflowAsync(string path, CancellationToken cancellationToken = default)
        => Task.FromResult(_graph.DeleteSavedWorkflow(path, Username));
}
