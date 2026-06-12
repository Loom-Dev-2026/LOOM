using System.Text.Json;
using System.Text.Json.Serialization;

namespace LOOM.Web.Services;

/// <summary>JSON options for Blazor → browser interop (camelCase).</summary>
public static class WebJson
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
}
