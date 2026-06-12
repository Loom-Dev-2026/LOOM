using System.Net.Http.Json;
using Loom.Api.Models;
using LOOM.Web.Options;
using Microsoft.Extensions.Options;

namespace LOOM.Web.Services;

public interface ILoomApiClient
{
    Guid SessionId { get; set; }
    string? Username { get; set; }
    Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<NodeTypeDefinitionDto>> GetNodeTypesAsync(CancellationToken cancellationToken = default);
    Task<CanvasWorkflowDto> GetWorkflowAsync(CancellationToken cancellationToken = default);
    Task<CanvasWorkflowDto> ReplaceWorkflowAsync(CanvasWorkflowDto workflow, CancellationToken cancellationToken = default);
    Task<CanvasWorkflowDto> AddNodeAsync(string type, double x, double y, CancellationToken cancellationToken = default);
    Task<CanvasWorkflowDto> UpdateNodeAsync(string clientNodeId, double? x, double? y, Dictionary<string, string>? fields, CancellationToken cancellationToken = default);
    Task<CanvasWorkflowDto> DeleteNodeAsync(string clientNodeId, CancellationToken cancellationToken = default);
    Task<ConnectionValidationResultDto> ValidateConnectionAsync(
        string fromClientId, string toClientId, string fromPort, string toPort,
        CancellationToken cancellationToken = default);
    Task<CanvasWorkflowDto> ConnectNodesAsync(
        string fromClientId, string toClientId, string fromPort, string toPort,
        CancellationToken cancellationToken = default);
    Task<CanvasWorkflowDto> DisconnectEdgeAsync(string edgeClientId, CancellationToken cancellationToken = default);
    Task<WorkflowExecutionResponseDto> ExecuteWorkflowAsync(CancellationToken cancellationToken = default);
    Task<ExportCSharpResponseDto> ExportCSharpAsync(CancellationToken cancellationToken = default);
    Task<bool> SaveWorkflowAsync(string path, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<string>> ListSavedWorkflowsAsync(CancellationToken cancellationToken = default);
    Task<CanvasWorkflowDto> LoadWorkflowFromPathAsync(string path, CancellationToken cancellationToken = default);
    Task<bool> DeleteSavedWorkflowAsync(string path, CancellationToken cancellationToken = default);
}

public sealed class RemoteLoomApiClient : ILoomApiClient
{
    private readonly HttpClient _http;
    private readonly ILogger<RemoteLoomApiClient> _logger;

    public Guid SessionId { get; set; }
    public string? Username { get; set; }

    public RemoteLoomApiClient(HttpClient http, IOptions<LoomApiOptions> options, ILogger<RemoteLoomApiClient> logger)
    {
        _http = http;
        _logger = logger;
        if (!string.IsNullOrWhiteSpace(options.Value.BaseUrl))
            _http.BaseAddress = new Uri(options.Value.BaseUrl.TrimEnd('/') + "/");
    }

    private string SessionPath(string sub) => $"api/sessions/{SessionId}/{sub}";

    public async Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            return (await _http.GetAsync("api/health", cancellationToken)).IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Health check failed.");
            return false;
        }
    }

    public async Task<IReadOnlyList<NodeTypeDefinitionDto>> GetNodeTypesAsync(CancellationToken cancellationToken = default)
    {
        var types = await _http.GetFromJsonAsync<List<NodeTypeDefinitionDto>>("api/node-types", cancellationToken);
        return types ?? [];
    }

    public Task<CanvasWorkflowDto> GetWorkflowAsync(CancellationToken cancellationToken = default)
        => _http.GetFromJsonAsync<CanvasWorkflowDto>(SessionPath("workflow"), cancellationToken)!;

    public Task<CanvasWorkflowDto> ReplaceWorkflowAsync(CanvasWorkflowDto workflow, CancellationToken cancellationToken = default)
    {
        return PutGraphAsync(SessionPath("workflow"), workflow, cancellationToken);
    }

    public Task<CanvasWorkflowDto> AddNodeAsync(string type, double x, double y, CancellationToken cancellationToken = default)
        => PostGraphAsync(SessionPath("nodes"), new AddCanvasNodeRequest { Type = type, X = x, Y = y }, cancellationToken);

    public Task<CanvasWorkflowDto> UpdateNodeAsync(string clientNodeId, double? x, double? y, Dictionary<string, string>? fields, CancellationToken cancellationToken = default)
        => PatchGraphAsync(SessionPath($"nodes/{clientNodeId}"), new UpdateCanvasNodeRequest { X = x, Y = y, Fields = fields }, cancellationToken);

    public Task<CanvasWorkflowDto> DeleteNodeAsync(string clientNodeId, CancellationToken cancellationToken = default)
        => DeleteGraphAsync(SessionPath($"nodes/{clientNodeId}"), cancellationToken);

    public Task<ConnectionValidationResultDto> ValidateConnectionAsync(
        string fromClientId, string toClientId, string fromPort, string toPort,
        CancellationToken cancellationToken = default)
        => PostJsonAsync<ConnectionValidationResultDto>(
            SessionPath("edges/validate"),
            new ConnectCanvasNodesRequest
            {
                FromNodeId = fromClientId,
                ToNodeId = toClientId,
                FromPort = fromPort,
                ToPort = toPort
            },
            cancellationToken);

    public Task<CanvasWorkflowDto> ConnectNodesAsync(
        string fromClientId, string toClientId, string fromPort, string toPort,
        CancellationToken cancellationToken = default)
        => PostGraphAsync(
            SessionPath("edges"),
            new ConnectCanvasNodesRequest
            {
                FromNodeId = fromClientId,
                ToNodeId = toClientId,
                FromPort = fromPort,
                ToPort = toPort
            },
            cancellationToken);

    public Task<CanvasWorkflowDto> DisconnectEdgeAsync(string edgeClientId, CancellationToken cancellationToken = default)
        => DeleteGraphAsync(SessionPath($"edges/{edgeClientId}"), cancellationToken);

    public async Task<WorkflowExecutionResponseDto> ExecuteWorkflowAsync(CancellationToken cancellationToken = default)
    {
        var response = await _http.PostAsync(SessionPath("execute"), null, cancellationToken);
        return await response.Content.ReadFromJsonAsync<WorkflowExecutionResponseDto>(cancellationToken: cancellationToken)
            ?? new WorkflowExecutionResponseDto { Success = false, Error = "Empty response." };
    }

    public Task<ExportCSharpResponseDto> ExportCSharpAsync(CancellationToken cancellationToken = default)
        => PostJsonAsync<ExportCSharpResponseDto>(SessionPath("export"), new { }, cancellationToken);

    public async Task<bool> SaveWorkflowAsync(string path, CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, SessionPath("save")) { Content = JsonContent.Create(new { path }) };
        if (!string.IsNullOrEmpty(Username)) request.Headers.Add("X-Loom-User", Username);
        var response = await _http.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode;
    }

    public async Task<IReadOnlyList<string>> ListSavedWorkflowsAsync(CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "api/workflows");
        if (!string.IsNullOrEmpty(Username)) request.Headers.Add("X-Loom-User", Username);
        var response = await _http.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        var list = await response.Content.ReadFromJsonAsync<List<string>>(cancellationToken: cancellationToken);
        return list ?? [];
    }

    public async Task<CanvasWorkflowDto> LoadWorkflowFromPathAsync(string path, CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, SessionPath("load-path")) { Content = JsonContent.Create(new { path }) };
        if (!string.IsNullOrEmpty(Username)) request.Headers.Add("X-Loom-User", Username);
        var response = await _http.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CanvasWorkflowDto>(cancellationToken: cancellationToken))!;
    }

    public async Task<bool> DeleteSavedWorkflowAsync(string path, CancellationToken cancellationToken = default)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "api/workflows/delete") { Content = JsonContent.Create(new { path }) };
        if (!string.IsNullOrEmpty(Username)) request.Headers.Add("X-Loom-User", Username);
        var response = await _http.SendAsync(request, cancellationToken);
        return response.IsSuccessStatusCode;
    }

    private async Task<CanvasWorkflowDto> PostGraphAsync<T>(string url, T body, CancellationToken ct)
    {
        var response = await _http.PostAsJsonAsync(url, body, ct);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CanvasWorkflowDto>(cancellationToken: ct))!;
    }

    private async Task<CanvasWorkflowDto> PatchGraphAsync<T>(string url, T body, CancellationToken ct)
    {
        var response = await _http.PatchAsJsonAsync(url, body, ct);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CanvasWorkflowDto>(cancellationToken: ct))!;
    }

    private async Task<CanvasWorkflowDto> PutGraphAsync<T>(string url, T body, CancellationToken ct)
    {
        var response = await _http.PutAsJsonAsync(url, body, ct);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CanvasWorkflowDto>(cancellationToken: ct))!;
    }

    private async Task<CanvasWorkflowDto> DeleteGraphAsync(string url, CancellationToken ct)
    {
        var response = await _http.DeleteAsync(url, ct);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CanvasWorkflowDto>(cancellationToken: ct))!;
    }

    private async Task<T> PostJsonAsync<T>(string url, object body, CancellationToken ct)
    {
        var response = await _http.PostAsJsonAsync(url, body, ct);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<T>(cancellationToken: ct))!;
    }
}
