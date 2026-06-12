# LOOM

Visual **number calculator** — enter values, apply arithmetic, get the answer. Blazor UI + C# workflow engine.

## Quick start

```powershell
cd "path\to\LOOM proj"
.\run.ps1
```

Or run **LOOM.Web** in Visual Studio (profile **loom**).

- **Canvas:** http://localhost:5280/canvas  
- **Health:** http://localhost:5280/api/health  

## Nodes

| Node | Purpose |
|------|---------|
| **NumberInput** | User enters a number |
| **MathOp** | Add, subtract, multiply, or divide (ports A & B) |
| **Result** | Shows the final value |

Connect: `NumberInput → MathOp (A/B) → Result`.

## Build

```powershell
dotnet build LOOM.sln
```
