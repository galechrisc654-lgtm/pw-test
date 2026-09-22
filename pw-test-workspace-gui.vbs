Option Explicit

Dim fso, shell, appShell, root, commandPath, choice, selected, action, command
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
Set appShell = CreateObject("Shell.Application")

root = fso.GetParentFolderName(WScript.ScriptFullName)
commandPath = fso.BuildPath(root, "pw-test-workspace.cmd")
If Not fso.FileExists(commandPath) Then
  MsgBox "请先完整解压 ZIP，再从解压后的目录运行 pw-test-workspace-gui.vbs。", vbExclamation, "PW 测试工作区"
  WScript.Quit 1
End If

choice = MsgBox("是：更新已有测试工作区" & vbCrLf & _
                "否：初始化新的测试工作区" & vbCrLf & _
                "取消：退出", vbYesNoCancel + vbQuestion, "PW 测试工作区")
If choice = vbCancel Then WScript.Quit 0
If choice = vbYes Then
  action = "update"
Else
  action = "init"
End If

Set selected = appShell.BrowseForFolder(0, "请选择测试工作区目录", &H41, 0)
If selected Is Nothing Then WScript.Quit 0

command = "cmd.exe /d /k " & Quote(Quote(commandPath) & " " & action & " " & Quote(selected.Self.Path))
shell.Run command, 1, False

Function Quote(value)
  Quote = Chr(34) & value & Chr(34)
End Function
