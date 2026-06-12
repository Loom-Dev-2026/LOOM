using Loom.Models;
using Loom.Models.Nodes;

namespace Loom.Api;

/// <summary>Resolves canvas port names to backend <see cref="Port"/> instances.</summary>
public static class CanvasPortResolver
{
    public static Port? FindOutputPort(Node node, string portName)
    {
        if (string.IsNullOrWhiteSpace(portName))
            return node.OutputPorts.FirstOrDefault(p =>
                       p.Name.Equals("Result", StringComparison.OrdinalIgnoreCase))
                   ?? node.OutputPorts.FirstOrDefault(p =>
                       p.Name.Equals("Value", StringComparison.OrdinalIgnoreCase))
                   ?? node.OutputPorts.FirstOrDefault();

        return node.OutputPorts.FirstOrDefault(p =>
                   p.Name.Equals(portName, StringComparison.OrdinalIgnoreCase))
               ?? node.OutputPorts.FirstOrDefault(p =>
                   p.Name.Equals("Value", StringComparison.OrdinalIgnoreCase))
               ?? node.OutputPorts.FirstOrDefault(p =>
                   p.Name.Equals("Result", StringComparison.OrdinalIgnoreCase))
               ?? node.OutputPorts.FirstOrDefault();
    }

    public static Port? FindInputPort(Node node, string portName)
    {
        if (string.IsNullOrWhiteSpace(portName))
            return node.InputPorts.FirstOrDefault();

        return node.InputPorts.FirstOrDefault(p =>
                   p.Name.Equals(portName, StringComparison.OrdinalIgnoreCase))
               ?? node.InputPorts.FirstOrDefault();
    }

    /// <summary>Default output port name for a canvas type when edge omits <see cref="CanvasEdgeDto.FromPort"/>.</summary>
    public static string DefaultOutputPort(string canvasType) =>
        CanvasNodeCatalog.GetDefinitions()
            .FirstOrDefault(d => d.Type.Equals(canvasType, StringComparison.OrdinalIgnoreCase))
            ?.Outputs.FirstOrDefault()?.Name
        ?? "Value";

    /// <summary>Default input port name for a canvas type when edge omits <see cref="CanvasEdgeDto.ToPort"/>.</summary>
    public static string DefaultInputPort(string canvasType) =>
        CanvasNodeCatalog.GetDefinitions()
            .FirstOrDefault(d => d.Type.Equals(canvasType, StringComparison.OrdinalIgnoreCase))
            ?.Inputs.FirstOrDefault()?.Name
        ?? "Value";
}
