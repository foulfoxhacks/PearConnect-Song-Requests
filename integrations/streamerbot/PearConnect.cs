using System;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

// Source for all generated actions. Secrets are read from local persisted globals.
public class CPHInline
{
    private const string Route = "/tikfinity";
    private static readonly HttpClient Http = new HttpClient(new HttpClientHandler
    {
        AllowAutoRedirect = false,
        UseProxy = false
    }) { Timeout = TimeSpan.FromSeconds(150) };

    public bool Execute()
    {
        CPH.SetArgument("pearconnectOk", false);
        CPH.SetArgument("pearconnectCode", "not_sent");
        CPH.SetArgument("pearconnectMessage", "");
        CPH.SetArgument("pearconnectHttpStatus", 0);
        try
        {
            string origin = CPH.GetGlobalVar<string>("PearConnect.Url", true);
            if (String.IsNullOrWhiteSpace(origin)) origin = "http://127.0.0.1:7280";
            Uri baseUri;
            if (!Uri.TryCreate(origin, UriKind.Absolute, out baseUri) ||
                baseUri.Scheme != "http" || baseUri.Host != "127.0.0.1" ||
                !String.IsNullOrEmpty(baseUri.UserInfo) || baseUri.AbsolutePath != "/" ||
                !String.IsNullOrEmpty(baseUri.Query) || !String.IsNullOrEmpty(baseUri.Fragment))
                throw new ArgumentException("PearConnect.Url must be http://127.0.0.1:PORT without a path or credentials.");

            object value;
            CPH.TryGetArg("username", out value);
            string user = Convert.ToString(value).Trim().TrimStart('@');
            if (String.IsNullOrWhiteSpace(user)) throw new ArgumentException("Missing TikFinity username. Use a real command or supply test arguments.");
            CPH.TryGetArg("userId", out value);
            string userId = Convert.ToString(value).Trim();
            CPH.TryGetArg("commandParams", out value);
            string query = Convert.ToString(value).Trim();
            string command = CPH.GetGlobalVar<string>("PearConnect.RequestCommand", true);
            if (String.IsNullOrWhiteSpace(command)) command = "sr";
            if (!Regex.IsMatch(command, @"^[a-zA-Z0-9_-]{1,32}$")) throw new ArgumentException("Invalid PearConnect.RequestCommand; omit the ! prefix.");
            string prefix = "!" + command;
            if (query.Equals(prefix, StringComparison.OrdinalIgnoreCase)) query = "";
            else if (query.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) && query.Length > prefix.Length && Char.IsWhiteSpace(query[prefix.Length])) query = query.Substring(prefix.Length).Trim();

            string secret = CPH.GetGlobalVar<string>("PearConnect.Secret", true) ?? "";
            if (secret.Length > 256 || Regex.IsMatch(secret, @"[^\x21-\x7e]")) throw new ArgumentException("PearConnect.Secret contains invalid header characters.");
            bool replies = CPH.GetGlobalVar<bool>("PearConnect.ChatReplies", true);
            string json = JsonConvert.SerializeObject(new { user = user, userId = userId, query = query });
            using (var request = new HttpRequestMessage(HttpMethod.Post, new Uri(baseUri, Route)))
            {
                request.Content = new StringContent(json, Encoding.UTF8, "application/json");
                request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("N"));
                if (secret.Length > 0) request.Headers.Add("X-Webhook-Secret", secret);
                using (var response = Http.SendAsync(request).GetAwaiter().GetResult())
                {
                    int status = (int)response.StatusCode;
                    CPH.SetArgument("pearconnectHttpStatus", status);
                    string body = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                    var result = JObject.Parse(body);
                    bool ok = response.IsSuccessStatusCode && result.Value<bool?>("ok") == true;
                    string code = result.Value<string>("code") ?? "unknown";
                    string message = result.Value<string>("message") ?? "";
                    CPH.SetArgument("pearconnectOk", ok);
                    CPH.SetArgument("pearconnectCode", code);
                    CPH.SetArgument("pearconnectMessage", message);
                    CPH.LogInfo("[PearConnect] HTTP " + status + ": " + code);
                    // Chat-delivery errors must not undo a completed request or cause a retry.
                    if (replies && Route != "/tikfinity/test" && response.IsSuccessStatusCode && message.Length > 0)
                    {
                        try
                        {
                            CPH.WebsocketBroadcastJson(JsonConvert.SerializeObject(new
                            {
                                action = "sendChatbotMessage", args = new { message = message }
                            }));
                        }
                        catch { CPH.LogWarn("[PearConnect] Request completed; TikFinity reply delivery failed."); }
                    }
                    return ok;
                }
            }
        }
        catch (Exception ex)
        {
            // Do not log raw responses, argument dictionaries, URLs, or credential values.
            CPH.SetArgument("pearconnectCode", "bridge_error");
            CPH.LogError("[PearConnect] " + ex.GetType().Name + ": check local settings and player state before retrying. No automatic retry was sent.");
            return false;
        }
    }
}
