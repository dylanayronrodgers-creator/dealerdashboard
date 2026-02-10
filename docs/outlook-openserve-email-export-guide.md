# Exporting Openserve Lead Emails from Outlook to CSV

## Overview

This guide walks you through extracting Openserve lead notification emails from Outlook and importing them into the Axxess Dealer Dashboard.

---

## Method: Outlook VBA Macro (Recommended)

This macro scans a selected Outlook folder for Openserve lead emails, parses the customer details from each email body, and exports them to a CSV file ready for import.

### Step 1: Open the VBA Editor in Outlook

1. Open **Outlook**
2. Press **Alt + F11** to open the VBA Editor
3. In the left panel, expand **Project1** → **Microsoft Outlook Objects**
4. Right-click **Modules** → **Insert** → **Module**
5. Paste the following code into the new module:

```vba
Sub ExportOpenserveLeadsToCSV()
    Dim olFolder As Outlook.MAPIFolder
    Dim olItem As Object
    Dim olMail As Outlook.MailItem
    Dim fso As Object
    Dim csvFile As Object
    Dim body As String
    Dim csvPath As String
    Dim count As Long
    
    ' Let user pick the folder containing Openserve emails
    Set olFolder = Application.Session.PickFolder
    If olFolder Is Nothing Then Exit Sub
    
    ' Set output path - change this to your preferred location
    csvPath = Environ("USERPROFILE") & "\Desktop\openserve_leads_export.csv"
    
    Set fso = CreateObject("Scripting.FileSystemObject")
    Set csvFile = fso.CreateTextFile(csvPath, True, True)
    
    ' Write CSV header
    csvFile.WriteLine "lead_id,dealer_code,full_name,email,phone,alt_phone,address,building,floor,unit,preferred_contact_time,email_date"
    
    count = 0
    
    For Each olItem In olFolder.Items
        If TypeOf olItem Is Outlook.MailItem Then
            Set olMail = olItem
            body = olMail.body
            
            ' Only process Openserve lead notification emails
            If InStr(body, "Lead ID:") > 0 And InStr(body, "Customer details:") > 0 Then
                Dim leadId As String
                Dim dealerCode As String
                Dim fullName As String
                Dim emailAddr As String
                Dim phone As String
                Dim altPhone As String
                Dim address As String
                Dim building As String
                Dim floorVal As String
                Dim unit As String
                Dim contactTime As String
                Dim emailDate As String
                
                leadId = ExtractField(body, "Lead ID:")
                dealerCode = ExtractField(body, "Dealer code:")
                fullName = ExtractField(body, "Full names:")
                If fullName = "" Then fullName = ExtractField(body, "Full name:")
                emailAddr = ExtractField(body, "Email address:")
                phone = ExtractField(body, "Primary contact number:")
                altPhone = ExtractField(body, "Alternative contact number:")
                address = ExtractField(body, "Physical address:")
                building = ExtractField(body, "Building:")
                floorVal = ExtractField(body, "Floor:")
                unit = ExtractField(body, "Unit:")
                contactTime = ExtractField(body, "Preferred contact time:")
                emailDate = Format(olMail.ReceivedTime, "yyyy-mm-dd hh:nn:ss")
                
                ' Escape commas in fields
                csvFile.WriteLine EscapeCSV(leadId) & "," & _
                    EscapeCSV(dealerCode) & "," & _
                    EscapeCSV(fullName) & "," & _
                    EscapeCSV(emailAddr) & "," & _
                    EscapeCSV(phone) & "," & _
                    EscapeCSV(altPhone) & "," & _
                    EscapeCSV(address) & "," & _
                    EscapeCSV(building) & "," & _
                    EscapeCSV(floorVal) & "," & _
                    EscapeCSV(unit) & "," & _
                    EscapeCSV(contactTime) & "," & _
                    EscapeCSV(emailDate)
                
                count = count + 1
            End If
        End If
    Next olItem
    
    csvFile.Close
    
    MsgBox "Export complete!" & vbCrLf & vbCrLf & _
           count & " Openserve leads exported to:" & vbCrLf & csvPath, _
           vbInformation, "Openserve Lead Export"
    
    ' Open the file location
    Shell "explorer.exe /select," & csvPath, vbNormalFocus
End Sub

Function ExtractField(body As String, fieldName As String) As String
    Dim startPos As Long
    Dim endPos As Long
    Dim value As String
    
    startPos = InStr(body, fieldName)
    If startPos = 0 Then
        ExtractField = ""
        Exit Function
    End If
    
    startPos = startPos + Len(fieldName)
    endPos = InStr(startPos, body, vbCrLf)
    If endPos = 0 Then endPos = InStr(startPos, body, vbLf)
    If endPos = 0 Then endPos = Len(body)
    
    value = Mid(body, startPos, endPos - startPos)
    ExtractField = Trim(value)
End Function

Function EscapeCSV(value As String) As String
    If InStr(value, ",") > 0 Or InStr(value, """") > 0 Or InStr(value, vbCrLf) > 0 Then
        EscapeCSV = """" & Replace(value, """", """""") & """"
    Else
        EscapeCSV = value
    End If
End Function
```

### Step 2: Run the Macro

1. Press **F5** or click **Run** in the VBA Editor
2. A folder picker will appear — **select the folder** containing your Openserve emails (e.g. Inbox, or a subfolder you've moved them to)
3. The macro will scan all emails, extract lead data, and save to `openserve_leads_export.csv` on your **Desktop**
4. A message box will confirm how many leads were exported

### Step 3: Import the CSV into the Dashboard

1. Open the **Admin Dashboard**
2. Go to **Import Leads** section
3. Upload the `openserve_leads_export.csv` file
4. The CSV columns map directly to the lead fields:

| CSV Column | Dashboard Field |
|---|---|
| `lead_id` | Lead ID (Openserve reference) |
| `dealer_code` | Matched to dealer by code |
| `full_name` | Full Name |
| `email` | Email |
| `phone` | Primary Phone |
| `alt_phone` | Secondary Contact Number |
| `address` | Physical Address |
| `building` | Appended to address |
| `floor` | Appended to address |
| `unit` | Appended to address |
| `preferred_contact_time` | Added to notes |
| `email_date` | Date captured |

---

## Tips

- **Filter first**: Before running the macro, move all Openserve lead emails to a dedicated subfolder in Outlook. This speeds up processing and avoids scanning unrelated emails.
- **Duplicates**: The dashboard's CSV importer checks for duplicate `lead_id` values, so re-importing the same CSV won't create duplicates.
- **PST files**: If you have a PST archive, open it in Outlook first (File → Open & Export → Open Outlook Data File), then run the macro on that folder.
- **Large exports**: The macro handles hundreds of emails efficiently. For thousands, it may take a minute or two.

---

## Troubleshooting

| Issue | Solution |
|---|---|
| "Macros are disabled" | Go to File → Options → Trust Center → Trust Center Settings → Macro Settings → Enable all macros |
| Folder picker doesn't appear | Make sure you're running the macro from within Outlook, not Excel |
| Missing fields in CSV | Some older Openserve emails may use slightly different field names. Check the email body format. |
| CSV encoding issues | The macro exports as UTF-8. If you see garbled characters, open in Notepad and re-save as UTF-8. |

---

## Alternative: Manual Copy-Paste

For small batches (1-10 emails), use the **Import Openserve Email** button in the Leads section:

1. Open the Openserve email in Outlook
2. Select all text in the email body (**Ctrl+A**)
3. Copy (**Ctrl+C**)
4. Go to Admin Dashboard → Leads → **Import Openserve Email**
5. Paste (**Ctrl+V**) and click **Parse Email**
6. Review and **Save Lead**
