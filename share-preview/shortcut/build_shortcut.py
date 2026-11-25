# Builds the "Share with PLAI" iPhone shortcut. Usage (macOS):
#   python3 build_shortcut.py unsigned.shortcut
#   shortcuts sign --mode anyone --input unsigned.shortcut --output Share-with-PLAI.shortcut
import plistlib, uuid, sys

def uid(): return str(uuid.uuid4()).upper()
def out(u, name): return {"OutputUUID": u, "OutputName": name, "Type": "ActionOutput"}
def attach(v): return {"Value": v, "WFSerializationType": "WFTextTokenAttachment"}
def tokens(parts):
    s, rng = "", {}
    for p in parts:
        if isinstance(p, str): s += p
        else:
            rng[f"{{{len(s.encode('utf-16-le'))//2}, 1}}"] = p
            s += "￼"
    return {"Value": {"string": s, "attachmentsByRange": rng}, "WFSerializationType": "WFTextTokenString"}

U_ENC, U_REQ, U_GET, U_TXT = (uid() for _ in range(4))
G_MENU = uid()

actions = [
  # 1 — URL-encode what was shared (a link, or text that contains a link)
  {"WFWorkflowActionIdentifier": "is.workflow.actions.urlencode",
   "WFWorkflowActionParameters": {"UUID": U_ENC, "WFEncodeMode": "Encode", "WFInput": tokens([{"Type": "ExtensionInput"}])}},
  # 2 — PLAI request URL
  {"WFWorkflowActionIdentifier": "is.workflow.actions.gettext",
   "WFWorkflowActionParameters": {"UUID": U_REQ, "WFTextActionText": tokens(
       ["https://plai.delaneyprojects.xyz/new?enc=", out(U_ENC, "URL Encoded Text"), "&url=", {"Type": "ExtensionInput"}])}},
  # 3 — ask PLAI (responds with the link as plain text, or a short reason)
  {"WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
   "WFWorkflowActionParameters": {"UUID": U_GET, "WFHTTPMethod": "GET", "WFURL": tokens([out(U_REQ, "Text")])}},
  # 4 — read the response as plain text
  {"WFWorkflowActionIdentifier": "is.workflow.actions.detect.text",
   "WFWorkflowActionParameters": {"UUID": U_TXT, "WFInput": attach(out(U_GET, "Contents of URL"))}},
  # 5 — menu showing the result: Send… / Copy link
  {"WFWorkflowActionIdentifier": "is.workflow.actions.choosefrommenu",
   "WFWorkflowActionParameters": {"GroupingIdentifier": G_MENU, "WFControlFlowMode": 0,
       "WFMenuPrompt": tokens(["PLAI link ready\n", out(U_TXT, "Text")]),
       "WFMenuItems": ["Send…", "Copy link"]}},
  {"WFWorkflowActionIdentifier": "is.workflow.actions.choosefrommenu",
   "WFWorkflowActionParameters": {"GroupingIdentifier": G_MENU, "WFControlFlowMode": 1, "WFMenuItemTitle": "Send…"}},
  {"WFWorkflowActionIdentifier": "is.workflow.actions.share",
   "WFWorkflowActionParameters": {"WFInput": attach(out(U_TXT, "Text"))}},
  {"WFWorkflowActionIdentifier": "is.workflow.actions.choosefrommenu",
   "WFWorkflowActionParameters": {"GroupingIdentifier": G_MENU, "WFControlFlowMode": 1, "WFMenuItemTitle": "Copy link"}},
  {"WFWorkflowActionIdentifier": "is.workflow.actions.setclipboard",
   "WFWorkflowActionParameters": {"WFInput": attach(out(U_TXT, "Text"))}},
  {"WFWorkflowActionIdentifier": "is.workflow.actions.notification",
   "WFWorkflowActionParameters": {"WFNotificationActionTitle": "PLAI", "WFNotificationActionBody": "PLAI link copied ✓",
       "WFNotificationActionSound": False}},
  {"WFWorkflowActionIdentifier": "is.workflow.actions.choosefrommenu",
   "WFWorkflowActionParameters": {"GroupingIdentifier": G_MENU, "WFControlFlowMode": 2}},
]

workflow = {
  "WFWorkflowName": "Share with PLAI",
  "WFWorkflowClientVersion": "1146.14",
  "WFWorkflowMinimumClientVersion": 900,
  "WFWorkflowMinimumClientVersionString": "900",
  "WFWorkflowIcon": {"WFWorkflowIconStartColor": 0xED4694FF, "WFWorkflowIconGlyphNumber": 0xE933},
  "WFWorkflowTypes": ["ActionExtension"],
  "WFWorkflowInputContentItemClasses": ["WFURLContentItem", "WFStringContentItem"],
  "WFWorkflowHasShortcutInputVariables": True,
  "WFWorkflowNoInputBehavior": {"Name": "WFWorkflowNoInputBehaviorGetClipboard", "Parameters": {}},
  "WFWorkflowOutputContentItemClasses": [],
  "WFWorkflowImportQuestions": [],
  "WFWorkflowActions": actions,
  "WFQuickActionSurfaces": [],
}
with open(sys.argv[1], "wb") as f:
    plistlib.dump(workflow, f, fmt=plistlib.FMT_BINARY)
print("wrote", len(actions), "actions, import questions:", len(workflow["WFWorkflowImportQuestions"]))
