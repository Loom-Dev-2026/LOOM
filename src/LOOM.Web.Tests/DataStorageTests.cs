using Loom.Models;
using Loom.Services;

namespace LOOM.Web.Tests;

public sealed class DataStorageTests : IDisposable
{
    private readonly string _tempDir;
    private readonly DataStorage _storage;

    public DataStorageTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), "LOOM_Test_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_tempDir);
        _storage = new DataStorage(_tempDir);
    }

    [Fact]
    public async Task Save_and_Load_workflow_roundtrip()
    {
        var wf = new Workflow("myworkflow");
        var path = Path.Combine(_tempDir, "test.loom");

        var saved = await _storage.SaveAsync(wf, path);
        Assert.True(saved);

        var loaded = await _storage.LoadAsync(path);
        Assert.NotNull(loaded);
        Assert.Equal(wf.SessionId, loaded.SessionId);
        Assert.Equal("myworkflow", loaded.WfName);
    }

    [Fact]
    public async Task SaveAsync_returns_false_on_invalid_path()
    {
        var wf = new Workflow("test");
        var saved = await _storage.SaveAsync(wf, "x:\\invalid\\\0\\path.loom");
        Assert.False(saved);
    }

    [Fact]
    public async Task LoadAsync_returns_null_for_missing_file()
    {
        var loaded = await _storage.LoadAsync(Path.Combine(_tempDir, "nope.loom"));
        Assert.Null(loaded);
    }

    [Fact]
    public void SaveData_and_LoadData_sync_roundtrip()
    {
        var wf = new Workflow("sync-test");
        var ok = _storage.SaveData(wf);
        Assert.True(ok);

        var loaded = _storage.LoadData(Path.Combine(_tempDir, $"{wf.SessionId}.loom"));
        Assert.NotNull(loaded);
        Assert.Equal(wf.SessionId, loaded.SessionId);
    }

    [Fact]
    public void LoadData_returns_null_for_missing_file()
    {
        var loaded = _storage.LoadData(Path.Combine(_tempDir, "missing.loom"));
        Assert.Null(loaded);
    }

    [Fact]
    public void GetUserDirectory_creates_sanitized_path()
    {
        var dir = _storage.GetUserDirectory("alice.smith");
        Assert.StartsWith(_tempDir, dir);
        Assert.True(Directory.Exists(dir));
    }

    [Fact]
    public void GetUserDirectory_removes_invalid_chars()
    {
        var dir = _storage.GetUserDirectory("bad<>user:name");
        var dirName = Path.GetFileName(dir);
        Assert.DoesNotContain("<", dirName);
        Assert.DoesNotContain(">", dirName);
        Assert.DoesNotContain(":", dirName);
        Assert.True(Directory.Exists(dir));
    }

    [Fact]
    public void ListWorkflowFiles_returns_empty_for_new_user()
    {
        var files = _storage.ListWorkflowFiles("newuser");
        Assert.Empty(files);
    }

    [Fact]
    public async Task ListWorkflowFiles_returns_saved_files()
    {
        var userDir = _storage.GetUserDirectory("listuser");
        var path = Path.Combine(userDir, "mylist.loom");
        var wf = new Workflow("list-test");
        await _storage.SaveAsync(wf, path);

        var files = _storage.ListWorkflowFiles("listuser");
        Assert.Contains(path, files);
    }

    [Fact]
    public void ResolveWorkflowPath_relative()
    {
        var resolved = _storage.ResolveWorkflowPath("test", "alice");
        Assert.StartsWith(_tempDir, resolved);
        Assert.EndsWith("alice\\test.loom", resolved, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ResolveWorkflowPath_absolute_preserved()
    {
        var abs = Path.Combine(_tempDir, "abs.loom");
        var resolved = _storage.ResolveWorkflowPath(abs);
        Assert.Equal(abs, resolved);
    }

    [Fact]
    public void ResolveWorkflowPath_appends_loom_extension()
    {
        var resolved = _storage.ResolveWorkflowPath("myworkflow", "bob");
        Assert.EndsWith(".loom", resolved);
        Assert.Contains("bob", resolved);
    }

    [Fact]
    public void ResolveWorkflowPath_throws_on_empty()
    {
        Assert.Throws<ArgumentException>(() => _storage.ResolveWorkflowPath(""));
        Assert.Throws<ArgumentException>(() => _storage.ResolveWorkflowPath("   "));
    }

    [Fact]
    public void DeleteWorkflowFile_removes_file()
    {
        var wf = new Workflow("delete-test");
        _storage.SaveData(wf);
        var path = Path.Combine(_tempDir, $"{wf.SessionId}.loom");
        Assert.True(File.Exists(path));

        var deleted = _storage.DeleteWorkflowFile(path);
        Assert.True(deleted);
        Assert.False(File.Exists(path));
    }

    [Fact]
    public void DeleteWorkflowFile_returns_false_for_missing()
    {
        var result = _storage.DeleteWorkflowFile(Path.Combine(_tempDir, "ghost.loom"));
        Assert.False(result);
    }

    [Fact]
    public async Task SaveAsync_is_thread_safe()
    {
        var wf = new Workflow("concurrent");
        var path = Path.Combine(_tempDir, "concurrent.loom");

        var tasks = Enumerable.Range(0, 20).Select(_ =>
            _storage.SaveAsync(wf, path));
        var results = await Task.WhenAll(tasks);

        Assert.All(results, r => Assert.True(r));
    }

    public void Dispose()
    {
        try { Directory.Delete(_tempDir, true); } catch { }
    }
}
