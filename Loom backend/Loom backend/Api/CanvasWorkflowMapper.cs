using Loom.Api.Models;
using Loom.Models;
using Loom.Models.Nodes;
using Loom.Services;
namespace Loom.Api;

public static class CanvasWorkflowMapper
{
    public static CanvasWorkflowDto ToCanvasDto(WorkflowSession session)
    {
        var wf = session.Workflow;
        var nodeLookup = wf.Nodes.ToDictionary(n => n.NodeId);
        var dto = new CanvasWorkflowDto
        {
            SessionId = wf.SessionId,
            Name = wf.WfName,
            Nodes = wf.Nodes.Select(n =>
            {
                session.NodeIdToClient.TryGetValue(n.NodeId, out var clientId);
                return new CanvasNodeDto
                {
                    Id = clientId ?? n.NodeId.ToString(),
                    Type = CanvasNodeCatalog.ResolveCanvasType(n),
                    X = n.Position.X,
                    Y = n.Position.Y,
                    Fields = ExtractFields(n),
                    ExecutionStatus = n.ExecutionState.ToString().ToLowerInvariant(),
                    LastOutput = FormatNodeOutput(n)
                };
            }).ToList(),
            Edges = wf.Connections.Select(c =>
            {
                session.ConnectionToEdgeClient.TryGetValue(c.ConnectionId, out var edgeId);
                session.NodeIdToClient.TryGetValue(c.SourceNodeId, out var from);
                session.NodeIdToClient.TryGetValue(c.TargetNodeId, out var to);
                if (nodeLookup.TryGetValue(c.SourceNodeId, out var srcNode)
                    && nodeLookup.TryGetValue(c.TargetNodeId, out var tgtNode))
                {
                    var srcPort = srcNode.OutputPorts.FirstOrDefault(p => p.PortId == c.SourcePortId);
                    var tgtPort = tgtNode.InputPorts.FirstOrDefault(p => p.PortId == c.TargetPortId);
                    return new CanvasEdgeDto
                    {
                        Id = edgeId ?? c.ConnectionId.ToString(),
                        From = from ?? c.SourceNodeId.ToString(),
                        To = to ?? c.TargetNodeId.ToString(),
                        FromPort = srcPort?.Name ?? string.Empty,
                        ToPort = tgtPort?.Name ?? string.Empty
                    };
                }
                return new CanvasEdgeDto
                {
                    Id = edgeId ?? c.ConnectionId.ToString(),
                    From = from ?? c.SourceNodeId.ToString(),
                    To = to ?? c.TargetNodeId.ToString()
                };
            }).ToList()
        };
        return dto;
    }

    public static (Workflow Workflow, Dictionary<string, Guid> ClientIdMap) ToWorkflow(
        CanvasWorkflowDto dto,
        NodeFactory factory,
        NodeManager nodeManager)
    {
        var workflow = new Workflow(string.IsNullOrWhiteSpace(dto.Name) ? "Untitled Workflow" : dto.Name);
        if (dto.SessionId is Guid sid)
            workflow.SessionId = sid;

        var idMap = new Dictionary<string, Guid>(StringComparer.Ordinal);

        foreach (var canvasNode in dto.Nodes)
        {
            if (!CanvasNodeCatalog.TryMapType(canvasNode.Type, out var nodeType))
                throw new InvalidOperationException($"Unknown node type: {canvasNode.Type}");

            var node = factory.Create(nodeType, canvasNode.Type);
            if (Guid.TryParse(canvasNode.Id, out var existingId))
                node.NodeId = existingId;
            else
                node.NodeId = Guid.NewGuid();

            node.Label = canvasNode.Type;
            node.Position = new LoomPoint(canvasNode.X, canvasNode.Y);
            ApplyFieldsToNode(node, canvasNode.Fields);

            foreach (var port in node.InputPorts.Concat(node.OutputPorts))
                port.NodeId = node.NodeId;

            workflow.Nodes.Add(node);
            idMap[canvasNode.Id] = node.NodeId;
        }

        foreach (var edge in dto.Edges)
        {
            if (!idMap.TryGetValue(edge.From, out var srcId) ||
                !idMap.TryGetValue(edge.To, out var tgtId))
                continue;

            var srcNode = workflow.Nodes.First(n => n.NodeId == srcId);
            var tgtNode = workflow.Nodes.First(n => n.NodeId == tgtId);

            var srcCanvasType = CanvasNodeCatalog.ResolveCanvasType(srcNode);
            var tgtCanvasType = CanvasNodeCatalog.ResolveCanvasType(tgtNode);
            var fromPortName = string.IsNullOrWhiteSpace(edge.FromPort)
                ? CanvasPortResolver.DefaultOutputPort(srcCanvasType)
                : edge.FromPort;
            var toPortName = string.IsNullOrWhiteSpace(edge.ToPort)
                ? CanvasPortResolver.DefaultInputPort(tgtCanvasType)
                : edge.ToPort;

            var srcPort = CanvasPortResolver.FindOutputPort(srcNode, fromPortName);
            var tgtPort = CanvasPortResolver.FindInputPort(tgtNode, toPortName);
            if (srcPort is null || tgtPort is null)
                continue;

            nodeManager.ConnectNodes(workflow, srcId, srcPort.PortId, tgtId, tgtPort.PortId);
        }

        return (workflow, idMap);
    }

    public static WorkflowExecutionResponseDto ToExecutionResponse(
        CanvasWorkflowDto dto,
        Workflow workflow,
        WorkflowExecutionContext ctx,
        Dictionary<string, Guid> clientToNode,
        long elapsedMs)
    {
        var nodeToClient = clientToNode.ToDictionary(kv => kv.Value, kv => kv.Key);

        var results = ctx.Results.Select(r =>
        {
            nodeToClient.TryGetValue(r.NodeId, out var clientId);
            return new NodeExecutionResultDto
            {
                ClientNodeId = clientId ?? r.NodeId.ToString(),
                Output = r.OutputValue?.ToString(),
                Status = r.Status.ToString(),
                ErrorMessage = r.ErrorMessage,
                ExecutionTimeMs = r.ExecutionTimeMs
            };
        }).ToList();

        foreach (var nodeDto in dto.Nodes)
        {
            var match = results.FirstOrDefault(r => r.ClientNodeId == nodeDto.Id);
            if (match is null) continue;

            clientToNode.TryGetValue(nodeDto.Id, out var backendNodeId);
            var backendNode = workflow.Nodes.FirstOrDefault(n => n.NodeId == backendNodeId);

            nodeDto.ExecutionStatus = match.Status switch
            {
                var s when s.Equals("Error", StringComparison.OrdinalIgnoreCase) => "error",
                var s when s.Equals("Skipped", StringComparison.OrdinalIgnoreCase) => "skipped",
                _ => "done"
            };

            nodeDto.ErrorMessage = match.ErrorMessage;

            if (match.Status.Equals("Success", StringComparison.OrdinalIgnoreCase))
            {
                nodeDto.LastOutput = backendNode is OutputNode output
                    ? output.Format(output.GetOutput())
                    : match.Output;
            }
            else if (match.Status.Equals("Skipped", StringComparison.OrdinalIgnoreCase))
            {
                nodeDto.LastOutput = null;
                nodeDto.ErrorMessage ??= "Skipped — fix upstream nodes first.";
            }
            else
            {
                nodeDto.LastOutput = null;
            }
        }

        var hadNodeErrors = ctx.Results.Any(r => r.Status == ResultStatus.Error);

        return new WorkflowExecutionResponseDto
        {
            Success = ctx.Status is ExecStatus.Completed && !hadNodeErrors,
            Status = ctx.Status.ToString(),
            ElapsedMs = elapsedMs,
            Results = results,
            Workflow = dto
        };
    }

    public static void ApplyFieldsToNode(Node node, Dictionary<string, string> fields)
    {
        if (node is InputNode input)
        {
            if (fields.TryGetValue("value", out var raw))
                input.UserInput = CanvasNodeCatalog.ResolveCanvasType(input)
                    .Equals("StringInput", StringComparison.OrdinalIgnoreCase)
                    ? raw
                    : ParseNumber(raw);
            return;
        }

        if (node is ArithmeticNode arithmetic && fields.TryGetValue("op", out var op))
        {
            arithmetic.Operation = ParseOperation(op);
            return;
        }

        if (node is OutputNode output && fields.TryGetValue("label", out var label))
            output.DisplayLabel = label;

        if (node is LogicNode logic && fields.TryGetValue("predicate", out var predicate))
            logic.Predicate = predicate;

        if (node is StringOpNode strOp && fields.TryGetValue("op", out var strOpVal))
            strOp.Operation = strOpVal;

        if (node is StringTransformNode strX && fields.TryGetValue("op", out var strXVal))
            strX.Operation = strXVal;

        if (node is UnaryMathNode unary && fields.TryGetValue("op", out var unaryVal))
            unary.Operation = unaryVal;

        if (node is MultiArithmeticNode multi && fields.TryGetValue("op", out var multiOp))
            multi.Operation = ParseOperation(multiOp);

        if (node is UserDefinedNode custom && fields.TryGetValue("script", out var script))
            custom.ScriptCode = script;

        if (node is WeatherNode weather && fields.TryGetValue("location", out var loc)
            && CityPresets.TryResolve(loc, out var lat, out var lon, out _))
        {
            weather.LocationPreset = loc;
            weather.DefaultLatitude = lat;
            weather.DefaultLongitude = lon;
        }

        if (node is GeocodeNode geocode && fields.TryGetValue("place", out var place))
            geocode.PlaceQuery = place;

    }

    /// <summary>
    /// Older sessions stored the Result node's display text in <see cref="Node.Label"/>.
    /// </summary>
    public static void NormalizeLegacyNodeLabels(Workflow workflow)
    {
        foreach (var node in workflow.Nodes)
        {
            if (node is not OutputNode output)
                continue;

            if (CanvasNodeCatalog.TryMapType(output.Label, out _))
                continue;

            output.DisplayLabel = output.Label;
            output.Label = "Result";
        }
    }

    private static string? FormatNodeOutput(Node node) => node switch
    {
        OutputNode output => output.GetOutput() is null ? null : output.Format(output.GetOutput()),
        _ => node.GetOutput()?.ToString()
    };

    public static Dictionary<string, string> ExtractFields(Node node) => node switch
    {
        InputNode input => new()
        {
            ["value"] = CanvasNodeCatalog.ResolveCanvasType(input)
                .Equals("StringInput", StringComparison.OrdinalIgnoreCase)
                ? input.UserInput?.ToString() ?? ""
                : FormatNumber(input.UserInput)
        },
        ArithmeticNode arith => new() { ["op"] = arith.Operation.ToString() },
        OutputNode output => new() { ["label"] = output.DisplayLabel },
        LogicNode logic => new() { ["predicate"] = logic.Predicate },
        StringOpNode strOp => new() { ["op"] = strOp.Operation },
        StringTransformNode strX => new() { ["op"] = strX.Operation },
        UnaryMathNode unary => new() { ["op"] = unary.Operation },
        MultiArithmeticNode multi => new() { ["op"] = multi.Operation.ToString() },
        UserDefinedNode custom => new() { ["script"] = custom.ScriptCode },
        WeatherNode weather => new() { ["location"] = weather.LocationPreset },
        GeocodeNode geocode => new() { ["place"] = geocode.PlaceQuery },
        _ => new()
    };

    private static string FormatNumber(object? value) =>
        value switch
        {
            null => "0",
            double d => d.ToString(System.Globalization.CultureInfo.InvariantCulture),
            float f => f.ToString(System.Globalization.CultureInfo.InvariantCulture),
            int i => i.ToString(System.Globalization.CultureInfo.InvariantCulture),
            _ => double.TryParse(value.ToString(), out var n)
                ? n.ToString(System.Globalization.CultureInfo.InvariantCulture)
                : "0"
        };

    private static double ParseNumber(string raw)
    {
        var trimmed = raw.Trim();
        return double.TryParse(trimmed, System.Globalization.NumberStyles.Float,
            System.Globalization.CultureInfo.InvariantCulture, out var n)
            ? n
            : 0;
    }

    private static OpType ParseOperation(string op) => op.Trim() switch
    {
        "+" or "Add" => OpType.Add,
        "-" or "Subtract" => OpType.Subtract,
        "*" or "Multiply" => OpType.Multiply,
        "/" or "Divide" => OpType.Divide,
        _ => OpType.Add
    };
}
