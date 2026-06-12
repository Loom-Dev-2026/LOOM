namespace Loom.Api.Models;

public sealed class CanvasWorkflowDto
{
    public Guid? SessionId { get; set; }
    public string Name { get; set; } = "Untitled Workflow";
    public List<CanvasNodeDto> Nodes { get; set; } = new();
    public List<CanvasEdgeDto> Edges { get; set; } = new();
}

public sealed class CanvasNodeDto
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public double X { get; set; }
    public double Y { get; set; }
    public Dictionary<string, string> Fields { get; set; } = new();
    public string? LastOutput { get; set; }
    public string ExecutionStatus { get; set; } = "idle";
    public string? ErrorMessage { get; set; }
}

public sealed class CanvasEdgeDto
{
    public string Id { get; set; } = string.Empty;
    public string From { get; set; } = string.Empty;
    public string To { get; set; } = string.Empty;
    public string FromPort { get; set; } = string.Empty;
    public string ToPort { get; set; } = string.Empty;
}

public sealed class SaveWorkflowRequest
{
    public string Path { get; set; } = string.Empty;
    public CanvasWorkflowDto? Workflow { get; set; }
}

public sealed class AddCanvasNodeRequest
{
    public string Type { get; set; } = string.Empty;
    public double X { get; set; }
    public double Y { get; set; }
}

public sealed class UpdateCanvasNodeRequest
{
    public double? X { get; set; }
    public double? Y { get; set; }
    public Dictionary<string, string>? Fields { get; set; }
}

public sealed class ConnectCanvasNodesRequest
{
    public string FromNodeId { get; set; } = string.Empty;
    public string ToNodeId { get; set; } = string.Empty;
    public string FromPort { get; set; } = string.Empty;
    public string ToPort { get; set; } = string.Empty;
}

public sealed class ConnectionValidationResultDto
{
    public bool Valid { get; set; }
    public string? Error { get; set; }
}

public sealed class WorkflowExecutionResponseDto
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public long ElapsedMs { get; set; }
    public string Status { get; set; } = string.Empty;
    public List<NodeExecutionResultDto> Results { get; set; } = new();
    public CanvasWorkflowDto? Workflow { get; set; }
}

public sealed class NodeExecutionResultDto
{
    public string ClientNodeId { get; set; } = string.Empty;
    public string? Output { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ErrorMessage { get; set; }
    public long ExecutionTimeMs { get; set; }
}

public sealed class NodeTypeDefinitionDto
{
    public string Type { get; set; } = string.Empty;
    public string BackendType { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<NodeFieldDefinitionDto> Fields { get; set; } = new();
    public List<NodePortDefinitionDto> Inputs { get; set; } = new();
    public List<NodePortDefinitionDto> Outputs { get; set; } = new();
}

public sealed class NodePortDefinitionDto
{
    public string Name { get; set; } = string.Empty;
    public string DataType { get; set; } = "object";
}

public sealed class NodeFieldDefinitionDto
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Default { get; set; } = string.Empty;
}

public sealed class ExportCSharpResponseDto
{
    public string FileName { get; set; } = "WorkflowRunner.cs";
    public string SourceCode { get; set; } = string.Empty;
}
