using Loom.Api.Models;
using Loom.Models;
using Loom.Models.Nodes;



namespace Loom.Api;



/// <summary>Canvas node library — inputs, math, logic, output.</summary>

public static class CanvasNodeCatalog

{

  private static readonly string[] MultiInputs =

      Enumerable.Range(1, MultiArithmeticNode.InputCount)

          .Select(i => $"In{i}")

          .ToArray();



    public static IReadOnlyList<NodeTypeDefinitionDto> GetDefinitions() =>

    [

        Def("NumberInput", NodeType.Input, "Input", "data", "Enter a number",

            outs: [Out("Value", "double")],

            fields: [Field("value", "Number", "0")]),

        Def("StringInput", NodeType.Input, "Input", "data", "Enter a text value",

            outs: [Out("Value", "string")],

            fields: [Field("value", "Text", "Hello World")]),

        Def("MathOp", NodeType.Arithmetic, "Math", "logic", "Add, subtract, multiply, or divide",

            ins: [In("A", "double"), In("B", "double")],

            outs: [Out("Result", "double")],

            fields: [Field("op", "Operation", "Add")]),

        Def("MathN", NodeType.Arithmetic, "Math", "logic", "Combine many numbers (wired inputs only)",

            ins: MultiInputs.Select(n => In(n, "double")).ToArray(),

            outs: [Out("Result", "double")],

            fields: [Field("op", "Operation", "Add")]),

        Def("Compare", NodeType.Logic, "Logic", "logic", "Compare A and B (==, !=, <, >, …)",

            ins: [In("A", "double"), In("B", "double")],

            outs: [Out("Result", "bool")],

            fields: [Field("predicate", "Predicate", "==")]),

        Def("CustomScript", NodeType.UserDefined, "Script", "script", "Custom C# (use inputs[\"A\"], inputs[\"B\"]; return a value)",

            ins: [In("A", "double"), In("B", "double")],

            outs: [Out("Value", "object"), Out("Result", "object")],

            fields: [Field("script", "Script", UserDefinedNode.DefaultScript)]),

        Def("Result", NodeType.Output, "Output", "output", "Final answer (chainable)",

            ins: [In("Value", "object")],

            outs: [Out("Value", "object")],

            fields: [Field("label", "Label", "Answer")]),

        Def("StringOp", NodeType.StringOp, "Text", "data", "ToUpper, ToLower, Trim, Length, Reverse",
            ins: [In("Value", "string")],
            outs: [Out("Result", "object")],
            fields: [Field("op", "Operation", "ToUpper")]),

        Def("StringTransform", NodeType.StringTransform, "Text", "data", "Concat, Replace, Contains, StartsWith, EndsWith, IndexOf",
            ins: [In("A", "string"), In("B", "string")],
            outs: [Out("Result", "object")],
            fields: [Field("op", "Operation", "Concat")]),

        Def("UnaryMath", NodeType.UnaryMath, "Math", "logic", "Sqrt, Abs, Ceiling, Floor, Round, Log, Log10, Exp, Sin, Cos, Tan, Asin, Acos, Atan, Square, Cube",
            ins: [In("Value", "double")],
            outs: [Out("Result", "double")],
            fields: [Field("op", "Operation", "Sqrt")]),

        Def("ApiWeather", NodeType.Weather, "API", "api",
            "Current weather (Open-Meteo, free)",

            ins: [In("Latitude", "double"), In("Longitude", "double")],

            outs: [Out("Result", "string")],

            fields: [Field("location", "City", "London")]),

        Def("ApiGeocode", NodeType.Api, "API", "api",
            "Address → map coordinates (Nominatim, free)",

            ins: [In("Place", "string")],

            outs: [Out("Result", "string")],

            fields: [Field("place", "Place", "London, UK")]),

        Def("ApiLocation", NodeType.Api, "API", "api",
            "Your approximate location from IP (free)",

            outs: [Out("Result", "string")]),

    ];



    public static string CanvasTypeFor(NodeType backendType) => backendType switch

    {

        NodeType.Input => "NumberInput",

        NodeType.Arithmetic => "MathOp",

        NodeType.Output => "Result",

        NodeType.Logic => "Compare",

        NodeType.StringOp => "StringOp",

        NodeType.StringTransform => "StringTransform",

        NodeType.UnaryMath => "UnaryMath",

        NodeType.UserDefined => "CustomScript",

        NodeType.Weather => "ApiWeather",

        NodeType.Api => "ApiGeocode",

        _ => backendType.ToString()

    };



    public static string GetDisplayName(string canvasType) => canvasType switch

    {

        "ApiWeather" => "Weather API",

        "StringInput" => "String input",

        "ApiGeocode" => "Geocode (Map)",

        "ApiLocation" => "My location (IP)",

        _ => canvasType

    };



    public static bool IsApiCanvasType(string? canvasType) =>

        canvasType is "ApiGeocode" or "ApiLocation";



    public static string ResolveCanvasType(Node node)

    {

        if (!string.IsNullOrWhiteSpace(node.Label)

            && (GetDefinitions().Any(d => d.Type.Equals(node.Label, StringComparison.OrdinalIgnoreCase))

                || IsLegacyCompareType(node.Label)))

            return node.Label;

        return CanvasTypeFor(node.Type);

    }



    public static bool TryMapType(string canvasType, out NodeType backendType)

    {

        if (IsLegacyCompareType(canvasType))

        {

            backendType = NodeType.Logic;

            return true;

        }



        var def = GetDefinitions().FirstOrDefault(d =>

            d.Type.Equals(canvasType, StringComparison.OrdinalIgnoreCase));

        if (def is null)

        {

            backendType = default;

            return false;

        }



        return Enum.TryParse(def.BackendType, ignoreCase: true, out backendType);

    }



    public static bool IsLegacyCompareType(string canvasType) =>

        canvasType.Equals("Equal", StringComparison.OrdinalIgnoreCase)

        || canvasType.Equals("CompareEq", StringComparison.OrdinalIgnoreCase)

        || canvasType.Equals("CompareNe", StringComparison.OrdinalIgnoreCase)

        || canvasType.Equals("CompareGt", StringComparison.OrdinalIgnoreCase)

        || canvasType.Equals("CompareGte", StringComparison.OrdinalIgnoreCase)

        || canvasType.Equals("CompareLt", StringComparison.OrdinalIgnoreCase)

        || canvasType.Equals("CompareLte", StringComparison.OrdinalIgnoreCase);



    public static bool IsMultiMath(string canvasType) =>

        canvasType.Equals("MathN", StringComparison.OrdinalIgnoreCase);



    private static NodeTypeDefinitionDto Def(

        string type,

        NodeType backend,

        string category,

        string color,

        string description,

        NodePortDefinitionDto[]? ins = null,

        NodePortDefinitionDto[]? outs = null,

        NodeFieldDefinitionDto[]? fields = null) =>

        new()

        {

            Type = type,

            BackendType = backend.ToString(),

            Category = category,

            Color = color,

            Description = description,

            Inputs = ins?.ToList() ?? [],

            Outputs = outs?.ToList() ?? [],

            Fields = fields?.ToList() ?? []

        };



    private static NodePortDefinitionDto In(string name, string dataType) =>

        new() { Name = name, DataType = dataType };



    private static NodePortDefinitionDto Out(string name, string dataType) =>

        new() { Name = name, DataType = dataType };



    private static NodeFieldDefinitionDto Field(string key, string label, string defaultValue) =>

        new() { Key = key, Label = label, Default = defaultValue };

}

