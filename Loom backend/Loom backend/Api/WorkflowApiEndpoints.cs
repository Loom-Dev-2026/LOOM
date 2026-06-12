using Loom.Api.Models;
using Loom.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Newtonsoft.Json;

namespace Loom.Api;

public static class WorkflowApiEndpoints
{
    public static IEndpointRouteBuilder MapWorkflowApi(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api").WithTags("Workflow");

        api.MapGet("/health", () => Results.Ok(new { status = "ok", service = "LoomBackend" }));
        api.MapGet("/node-types", () => Results.Ok(CanvasNodeCatalog.GetDefinitions()));
        api.MapGet("/workflows", (HttpContext ctx, WorkflowGraphService graph) =>
        {
            var username = GetLoomUser(ctx);
            return Results.Ok(graph.ListSavedWorkflows(username));
        });

        api.MapPost("/workflows/delete", (HttpContext ctx, [FromBody] SavePathRequest req, WorkflowGraphService graph) =>
        {
            if (string.IsNullOrWhiteSpace(req.Path))
                return Results.BadRequest(new { error = "Path is required." });
            var username = GetLoomUser(ctx);
            var ok = graph.DeleteSavedWorkflow(req.Path, username);
            return ok
                ? Results.Ok(new { deleted = true, path = req.Path })
                : Results.NotFound(new { error = "Workflow file not found." });
        });

        var sessions = api.MapGroup("/sessions/{sessionId:guid}");

        sessions.MapGet("/workflow", (Guid sessionId, WorkflowGraphService graph) =>
            Results.Ok(graph.GetWorkflow(sessionId)));

        sessions.MapPut("/workflow", async (Guid sessionId, CanvasWorkflowDto dto, WorkflowGraphService graph) =>
            Results.Ok(await graph.ReplaceWorkflowAsync(sessionId, dto)));

        sessions.MapPost("/nodes", async (Guid sessionId, AddCanvasNodeRequest req, WorkflowGraphService graph) =>
        {
            try
            {
                return Results.Ok(await graph.AddNodeAsync(sessionId, req.Type, req.X, req.Y));
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        sessions.MapPatch("/nodes/{clientNodeId}", async (
            Guid sessionId, string clientNodeId, UpdateCanvasNodeRequest req, WorkflowGraphService graph) =>
        {
            try
            {
                return Results.Ok(await graph.UpdateNodeAsync(sessionId, clientNodeId, req.X, req.Y, req.Fields));
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        sessions.MapDelete("/nodes/{clientNodeId}", async (
            Guid sessionId, string clientNodeId, WorkflowGraphService graph) =>
        {
            try
            {
                return Results.Ok(await graph.DeleteNodeAsync(sessionId, clientNodeId));
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        sessions.MapPost("/edges/validate", (Guid sessionId, ConnectCanvasNodesRequest req, WorkflowGraphService graph) =>
            Results.Ok(graph.ValidateConnection(
                sessionId, req.FromNodeId, req.ToNodeId, req.FromPort, req.ToPort)));

        sessions.MapPost("/edges", async (Guid sessionId, ConnectCanvasNodesRequest req, WorkflowGraphService graph) =>
        {
            try
            {
                return Results.Ok(await graph.ConnectNodesAsync(
                    sessionId, req.FromNodeId, req.ToNodeId, req.FromPort, req.ToPort));
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        sessions.MapDelete("/edges/{edgeClientId}", async (
            Guid sessionId, string edgeClientId, WorkflowGraphService graph) =>
        {
            try
            {
                return Results.Ok(await graph.DisconnectEdgeAsync(sessionId, edgeClientId));
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        sessions.MapPost("/execute", async (Guid sessionId, WorkflowGraphService graph) =>
        {
            var response = await graph.ExecuteAsync(sessionId);
            return response.Success ? Results.Ok(response) : Results.BadRequest(response);
        });

        sessions.MapPost("/export", (Guid sessionId, WorkflowGraphService graph) =>
        {
            try
            {
                return Results.Ok(graph.ExportCSharp(sessionId));
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        sessions.MapPost("/save", async (HttpContext ctx, Guid sessionId, [FromBody] SavePathRequest req, WorkflowGraphService graph) =>
        {
            if (string.IsNullOrWhiteSpace(req.Path))
                return Results.BadRequest(new { error = "Path is required." });
            var username = GetLoomUser(ctx);
            var ok = await graph.SaveToPathAsync(sessionId, req.Path, username);
            return ok ? Results.Ok(new { saved = true, path = req.Path }) : Results.Problem("Save failed.");
        });

        sessions.MapPost("/load-path", async (HttpContext ctx, Guid sessionId, [FromBody] SavePathRequest req, WorkflowGraphService graph) =>
        {
            if (string.IsNullOrWhiteSpace(req.Path))
                return Results.BadRequest(new { error = "Path is required." });
            var username = GetLoomUser(ctx);
            try
            {
                return Results.Ok(await graph.LoadFromPathAsync(sessionId, req.Path, username));
            }
            catch (InvalidOperationException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
        });

        // Legacy routes (session in body)
        api.MapPost("/workflow/execute", async (CanvasWorkflowDto dto, WorkflowGraphService graph) =>
        {
            if (dto.SessionId is not Guid sid)
                return Results.BadRequest(new { error = "sessionId is required." });
            await graph.ReplaceWorkflowAsync(sid, dto);
            var response = await graph.ExecuteAsync(sid);
            return response.Success ? Results.Ok(response) : Results.BadRequest(response);
        });

        api.MapPost("/workflow/save", async (SaveWorkflowRequest request, WorkflowGraphService graph) =>
        {
            if (request.Workflow?.SessionId is not Guid sid)
                return Results.BadRequest(new { error = "sessionId is required." });
            await graph.ReplaceWorkflowAsync(sid, request.Workflow);
            var ok = await graph.SaveToPathAsync(sid, request.Path);
            return ok ? Results.Ok(new { saved = true }) : Results.Problem("Save failed.");
        });

        api.MapPost("/workflow/load", async (LoadWorkflowRequest request, DataStorage storage) =>
        {
            var workflow = await storage.LoadAsync(request.Path);
            if (workflow is null)
                return Results.NotFound(new { error = "Not found." });
            var json = JsonConvert.SerializeObject(workflow, DataStorage.SerializerSettings);
            return Results.Content(json, "application/json");
        });

        return app;
    }

    private static string? GetLoomUser(HttpContext ctx)
    {
        if (ctx.Request.Headers.TryGetValue("X-Loom-User", out var value))
            return value.FirstOrDefault();
        return null;
    }
}

public sealed class LoadWorkflowRequest
{
    public string Path { get; set; } = string.Empty;
}

public sealed class SavePathRequest
{
    public string Path { get; set; } = string.Empty;
}
