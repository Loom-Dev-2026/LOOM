<div align="center">

# LOOM

### Visual Programming Platform — build logic as node graphs, compile to real C#

[![Live](https://img.shields.io/badge/Live-loom.runasp.net-C9F24B?style=for-the-badge)](https://loom.runasp.net/)
[![.NET](https://img.shields.io/badge/.NET-8-512BD4?style=for-the-badge&logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![Blazor](https://img.shields.io/badge/Blazor-512BD4?style=for-the-badge&logo=blazor&logoColor=white)](https://learn.microsoft.com/aspnet/core/blazor/)
[![C#](https://img.shields.io/badge/C%23-239120?style=for-the-badge&logo=csharp&logoColor=white)](https://learn.microsoft.com/dotnet/csharp/)

**[🚀 Try the live app](https://loom.runasp.net/)** · **[▶ Watch the demo](#-demo)**

</div>

---

## ✨ Overview

**LOOM** is a visual programming platform where you build logic on an infinite node canvas instead of writing code by hand. Drag out nodes, wire their ports together, hit **Run** to execute the graph, and **Export** it to clean, runnable **C#** — the visual graph *is* the program.

Built with **Blazor** and **.NET**, LOOM combines a real-time node editor, live execution, code generation, authenticated cloud persistence, and a shareable file format (`.loom`) in one browser-based tool.

> **The idea:** lower the barrier to programming logic while keeping a direct, honest path back to real source code — no black boxes.

---

## 🎬 Demo

https://github.com/Loom-Dev-2026/LOOM/assets/demo.mp4

> **▶ Full live version:** **[loom.runasp.net](https://loom.runasp.net/)**

<sub>To embed the video so it plays inline on GitHub: open this README on github.com in the web editor, delete the line above, then **drag `assets/demo.mp4` into the editor** — GitHub uploads it and inserts a playable link automatically. (GitHub renders committed `.mp4` files as inline players.)</sub>

---

## 🧩 Features

| | |
|---|---|
| 🎨 **Visual node canvas** | Infinite pannable/zoomable workspace for composing logic as connected nodes. |
| 🔌 **Port-based wiring** | Connect a node's output port to another's input by dragging — typed connections keep graphs valid. |
| ⚡ **Live execution** | Press **Run** to evaluate the graph in place; nodes surface their state (idle · running · done). |
| 🧾 **C# code generation** | **Export** any graph into readable, runnable C# — the compiled form of your visual logic. |
| 💾 **`.loom` project files** | Save, load, and share graphs as portable `.loom` documents. |
| 🔐 **Authentication** | Sign in with **Google** or **GitHub** via OAuth. |
| ☁️ **Cloud persistence** | Your workspaces are saved to your account and synced across sessions. |
| 🌐 **Runs in the browser** | No install — the whole editor ships as a Blazor web app. |

---

## 🛠️ Tech Stack

- **Frontend / UI:** Blazor (interactive web UI, C# end-to-end)
- **Language & Runtime:** C# · .NET
- **Code generation:** Graph → C# source compiler
- **Auth:** OAuth 2.0 (Google, GitHub)
- **Persistence:** Cloud-backed project storage
- **Hosting:** Deployed on [loom.runasp.net](https://loom.runasp.net/)

---

## 🚀 Getting Started

### Use it now
No setup required — just open **[loom.runasp.net](https://loom.runasp.net/)** and sign in with Google or GitHub.

### Run locally

**Prerequisites:** [.NET SDK 8.0+](https://dotnet.microsoft.com/download)

```bash
# 1. Clone
git clone https://github.com/Loom-Dev-2026/LOOM.git
cd LOOM

# 2. Restore dependencies
dotnet restore

# 3. Run
dotnet run
```

Then open the URL printed in the console (typically `https://localhost:5001`).

> **Auth & cloud features:** Google/GitHub sign-in and cloud persistence require OAuth client credentials and a storage connection string. Add them via user secrets or `appsettings.Development.json`:
>
> ```bash
> dotnet user-secrets set "Authentication:Google:ClientId" "..."
> dotnet user-secrets set "Authentication:Google:ClientSecret" "..."
> dotnet user-secrets set "Authentication:GitHub:ClientId" "..."
> dotnet user-secrets set "Authentication:GitHub:ClientSecret" "..."
> ```
>
> Without them, LOOM still runs — you can build, execute and export graphs locally; only sign-in and cloud sync are disabled.

---

## 🧠 How It Works

```
   ┌──────────────┐        ┌──────────────┐
   │  String node │──────▶ │  Answer node │
   │ "Hello World"│  wire  │      —       │
   └──────────────┘        └──────────────┘
          │                        │
          ▼                        ▼
   ┌─────────────────────────────────────┐
   │   Run  →  evaluate graph in place    │
   │   Export → generate equivalent C#    │
   └─────────────────────────────────────┘
```

1. **Compose** — drop nodes onto the canvas; each has typed input and output ports.
2. **Connect** — drag from an output port to an input port to define data flow.
3. **Run** — LOOM walks the graph in dependency order and executes it live.
4. **Export** — the same graph is translated into a C# program you can run outside LOOM.
5. **Save** — persist the graph as a `.loom` file or to your cloud account.

---

## 🗺️ Roadmap

- [ ] Expanded node library (math, control flow, collections, I/O)
- [ ] Custom / reusable sub-graph nodes
- [ ] Real-time collaboration on a shared canvas
- [ ] Export to additional targets beyond C#
- [ ] Community graph gallery

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome. Open an issue to discuss a change, or fork the repo and submit a pull request.

---

## 📄 License

Released under the MIT License — see [`LICENSE`](LICENSE) for details.

---

<div align="center">

**Built with Blazor & .NET** · **[loom.runasp.net](https://loom.runasp.net/)**

</div>


