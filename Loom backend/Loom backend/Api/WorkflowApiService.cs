using Loom.Api.Models;

namespace Loom.Api;

/// <summary>
/// Legacy facade — prefer <see cref="WorkflowGraphService"/> for session-based graph operations.
/// </summary>
public sealed class WorkflowApiService
{
    public object GetHealth() => new { status = "ok", service = "LoomBackend" };

    public IReadOnlyList<NodeTypeDefinitionDto> GetNodeTypes()
        => CanvasNodeCatalog.GetDefinitions();
}
