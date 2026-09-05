using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

// A narrow test double for documented CPH methods, not the Streamer.bot runtime.
public class FakeCPH
{
    public Dictionary<string, object> Args = new Dictionary<string, object>();
    public Dictionary<string, object> Globals = new Dictionary<string, object>();
    public List<string> Broadcasts = new List<string>();
    public bool FailBroadcast;
    public bool TryGetArg<T>(string name, out T value)
    {
        object raw; bool found = Args.TryGetValue(name, out raw);
        value = found ? (T)raw : default(T); return found;
    }
    public T GetGlobalVar<T>(string name, bool persisted)
    { object raw; return Globals.TryGetValue(name, out raw) ? (T)raw : default(T); }
    public void SetArgument(string name, object value) { Args[name] = value; }
    public void LogInfo(string message) { Console.WriteLine(message); }
    public void LogError(string message) { Console.WriteLine(message); }
    public void LogWarn(string message) { Console.WriteLine(message); }
    public void WebsocketBroadcastJson(string value)
    { if (FailBroadcast) throw new Exception(); Broadcasts.Add(value); }
}
public class CPHInlineBase { public FakeCPH CPH = new FakeCPH(); }
public static class Program
{
    private static int passed;
    private static void Check(bool value, string name)
    { if (!value) throw new Exception("FAILED: " + name); passed++; Console.WriteLine("PASS: " + name); }
    private static T New<T>(string url, string user = "alice") where T : CPHInlineBase, new()
    {
        var script = new T();
        script.CPH.Globals["PearConnect.Url"] = url;
        script.CPH.Globals["PearConnect.Secret"] = "ci-test-secret";
        script.CPH.Args["username"] = user;
        script.CPH.Args["userId"] = user + "-id";
        return script;
    }
    public static int Main(string[] args)
    {
        try
        {
            string url = args[0];
            var request = New<Script0>(url);
            request.CPH.Args["commandParams"] = "!sr Björk \"Jóga\" 🦊";
            request.CPH.Globals["PearConnect.ChatReplies"] = true;
            Check(request.Execute(), "song request accepted");
            Check((string)request.CPH.Args["pearconnectCode"] == "added", "explicit added outcome");
            Check(request.CPH.Broadcasts.Count == 1, "optional chat relay");
            JObject chat = JObject.Parse(request.CPH.Broadcasts[0]);
            Check((string)chat["action"] == "sendChatbotMessage" && ((JObject)chat["args"]).Count == 1 && chat["args"]["message"] != null, "relay contains only message, never secrets or full args");
            Check(!request.Execute() && (string)request.CPH.Args["pearconnectCode"] == "cooldown", "policy rejection not treated as success");
            Check(New<Script1>(url).Execute(), "now playing");
            Check(New<Script2>(url).Execute(), "queue peek");
            Check(!New<Script3>(url).Execute(), "unprivileged skip denied");
            Check(New<Script3>(url, "mod").Execute(), "authorized skip");
            Check(New<Script4>(url).Execute(), "connection test is non-mutating");
            var wrong = New<Script0>(url, "wrong"); wrong.CPH.Globals["PearConnect.Secret"] = "wrong"; wrong.CPH.Args["commandParams"] = "test";
            Check(!wrong.Execute() && (int)wrong.CPH.Args["pearconnectHttpStatus"] == 403, "secret authentication failure");
            var badUrl = New<Script0>("http://example.invalid"); Check(!badUrl.Execute(), "non-loopback URL blocked");
            var missing = New<Script0>(url, ""); Check(!missing.Execute(), "missing user rejected");
            var empty = New<Script0>(url, "empty"); empty.CPH.Args["commandParams"] = "!sr";
            Check(!empty.Execute() && (string)empty.CPH.Args["pearconnectCode"] == "usage", "empty command parameters");
            var custom = New<Script0>(url, "custom"); custom.CPH.Globals["PearConnect.RequestCommand"] = "song"; custom.CPH.Args["commandParams"] = "!song Custom Query";
            Check(custom.Execute(), "custom command prefix");
            var exact = New<Script0>(url, "exact"); exact.CPH.Args["commandParams"] = "!srtune";
            Check(exact.Execute(), "do not strip unrelated prefixes");
            var delivery = New<Script0>(url, "delivery"); delivery.CPH.Args["commandParams"] = "Delivery Test"; delivery.CPH.Globals["PearConnect.ChatReplies"] = true; delivery.CPH.FailBroadcast = true;
            Check(delivery.Execute(), "failed chat delivery preserves accepted request");
            Console.WriteLine(passed + " C# bridge checks passed (.NET Framework 4.8 / CPH test double).");
            return 0;
        }
        catch (Exception ex) { Console.Error.WriteLine(ex); return 1; }
    }
}
