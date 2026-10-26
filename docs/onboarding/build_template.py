"""Builds the school onboarding workbook that schools fill in and send back.

    python3 docs/onboarding/build_template.py docs/onboarding/school-onboarding-template.xlsx

Needs openpyxl. Columns follow prisma/schema.prisma: keep them in step when the
schema changes.
"""
import sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment
from openpyxl.utils import get_column_letter

OUT = sys.argv[1]
FONT = "Arial"
MAX_ROW = 1000
MAX_STOPS = 25

hdr_req = PatternFill("solid", fgColor="1F3A5F")
hdr_opt = PatternFill("solid", fgColor="5B7A99")
example_fill = PatternFill("solid", fgColor="EDEDED")
input_fill = PatternFill("solid", fgColor="FFF9DB")
thin = Side(style="thin", color="BFBFBF")
border = Border(left=thin, right=thin, top=thin, bottom=thin)

wb = Workbook()

# ---------- Instructions ----------
ins = wb.active
ins.title = "Instructions"
ins.sheet_view.showGridLines = False
lines = [
    ("Bus Buddy: School Onboarding Data", Font(name=FONT, size=16, bold=True, color="1F3A5F")),
    ("Please fill in every tab and email this file back to us.", Font(name=FONT, size=11)),
    ("", None),
    ("How to fill this workbook", Font(name=FONT, size=12, bold=True)),
    ("1. Each tab is one list. Add one item per row, starting at row 3.", None),
    ("2. Row 2 on each tab (grey, italic) is an EXAMPLE showing the format. Leave it or overwrite it; we skip it on import.", None),
    ("3. Dark blue column headers marked * are REQUIRED. Lighter headers are optional but helpful.", None),
    ("4. Yellow cells are where you type. Columns with a dropdown only accept the listed values.", None),
    ("5. Hover over a header to see a note explaining that column.", None),
    ("6. Tabs link to each other by Bus No and Stop Name. Spell them exactly the same everywhere.", None),
    ("", None),
    ("Suggested order", Font(name=FONT, size=12, bold=True)),
    ("School → Admin Users → Stops → Buses (route and stops in order) → Stop Timings → Crew → Students → Parents → Documents", None),
    ("", None),
    ("Formats", Font(name=FONT, size=12, bold=True)),
    ("Mobile numbers: with country code, e.g. +91 9876543210", None),
    ("Times: 24-hour HH:MM, e.g. 07:25 or 16:20", None),
    ("Dates: DD-MM-YYYY, e.g. 31-03-2027", None),
    ("Location: paste a Google Maps link, or latitude and longitude, e.g. 17.4598, 78.3637", None),
    ("", None),
    ("Privacy", Font(name=FONT, size=12, bold=True)),
    ("This file contains children's and parents' personal data. Send it only to your Bus Buddy contact, and please",
     None),
    ("confirm that parents have consented to their mobile numbers being used for the parent app and bus alerts.", None),
    ("Face recognition is not used, so no face photos are needed. Student photos are optional.", None),
]
for i, (text, font) in enumerate(lines, start=1):
    c = ins.cell(row=i, column=2, value=text)
    c.font = font or Font(name=FONT, size=11)
ins.column_dimensions["A"].width = 3
ins.column_dimensions["B"].width = 120

# Legend
r = len(lines) + 2
ins.cell(row=r, column=2, value="Legend").font = Font(name=FONT, size=12, bold=True)
legend = [
    (hdr_req, "Required column *", "FFFFFF"),
    (hdr_opt, "Optional column", "FFFFFF"),
    (example_fill, "Example row: shows the format", "000000"),
    (input_fill, "Cells for you to fill", "000000"),
]
for j, (fill, text, color) in enumerate(legend, start=1):
    c = ins.cell(row=r + j, column=2, value=text)
    c.fill = fill
    c.font = Font(name=FONT, size=11, color=color, italic=(fill is example_fill))
    c.border = border


# ---------- Data tabs ----------
# column spec: (header, required, width, note, dropdown list or ref, example, text_format)
def sheet(title, cols, example, rows_hint=MAX_ROW):
    ws = wb.create_sheet(title)
    for ci, (head, req, width, note, dv) in enumerate(cols, start=1):
        cell = ws.cell(row=1, column=ci, value=head + (" *" if req else ""))
        cell.font = Font(name=FONT, bold=True, color="FFFFFF")
        cell.fill = hdr_req if req else hdr_opt
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        cell.border = border
        if note:
            cell.comment = Comment(note, "Bus Buddy")
        ws.column_dimensions[get_column_letter(ci)].width = width
        ex = ws.cell(row=2, column=ci, value=example[ci - 1])
        ex.font = Font(name=FONT, italic=True, color="595959")
        ex.fill = example_fill
        ex.border = border
        ex.number_format = "@"
        for rr in range(3, rows_hint + 3):
            c = ws.cell(row=rr, column=ci)
            c.fill = input_fill
            c.border = border
            c.font = Font(name=FONT)
            c.number_format = "@"  # keep phones, times, IDs as typed
        if dv:
            if isinstance(dv, list):
                formula = '"' + ",".join(dv) + '"'
            else:
                formula = dv
            v = DataValidation(type="list", formula1=formula, allow_blank=True, showErrorMessage=True,
                               errorTitle="Not in the list", error="Pick a value from the dropdown.")
            ws.add_data_validation(v)
            col = get_column_letter(ci)
            v.add(f"{col}3:{col}{rows_hint + 2}")
    ws.row_dimensions[1].height = 34
    ws.freeze_panes = "A3"
    return ws


small = 200

# School is a key/value form
sch = wb.create_sheet("School")
sch.column_dimensions["A"].width = 38
sch.column_dimensions["B"].width = 40
sch.column_dimensions["C"].width = 30
sch.column_dimensions["D"].width = 60
for ci, h in enumerate(["Field", "Your answer", "Example", "Notes"], start=1):
    c = sch.cell(row=1, column=ci, value=h)
    c.font = Font(name=FONT, bold=True, color="FFFFFF")
    c.fill = hdr_req
    c.border = border
school_rows = [
    ("School name *", "Sunrise Public School", "As it should appear in the apps."),
    ("Branch / campus", "Kondapur Campus", "If the school has more than one."),
    ("School address", "Plot 12, Kondapur, Hyderabad 500084", "Used as the start/end of every route."),
    ("School location (Maps link or lat, lng)", "17.4598, 78.3637", ""),
    ("Main phone", "+91 4012345678", "Shown to parents as the school contact."),
    ("Transport office phone", "+91 9876500000", "Shown to parents and crew for transport issues."),
    ("Transport office email", "transport@school.edu.in", ""),
    ("Logo", "Attach a PNG/SVG with this email", "Square, at least 512 × 512 px."),
    ("Morning trip window: start *", "06:30", "Earliest a morning trip can begin (HH:MM)."),
    ("Morning trip window: end *", "08:30", "Latest a morning trip should finish."),
    ("Evening trip window: start *", "15:30", ""),
    ("Evening trip window: end *", "17:30", ""),
    ("Late threshold (minutes)", "5", "Minutes behind schedule before a bus counts as delayed. Default 5."),
    ("CCTV recording retention (days)", "30", "7 to 365. Default 30."),
    ("Require every child marked dropped before evening trip closes?", "Yes", "Yes / No. Default Yes."),
    ("Working days", "Mon–Sat", "Which days buses run."),
    ("Academic year start date", "01-06-2026", "DD-MM-YYYY"),
    ("GPS tracker vendor", "LivePin", "If you already have trackers fitted."),
    ("LivePin API key", "Send separately", "Please share credentials by phone or a separate secure message, NOT in this file."),
    ("Parent app languages needed", "English, Telugu", ""),
]
yesno = DataValidation(type="list", formula1='"Yes,No"', allow_blank=True)
sch.add_data_validation(yesno)
for i, (f, ex, note) in enumerate(school_rows, start=2):
    a = sch.cell(row=i, column=1, value=f)
    a.font = Font(name=FONT, bold=f.endswith("*"))
    a.border = border
    b = sch.cell(row=i, column=2)
    b.fill = input_fill
    b.border = border
    b.font = Font(name=FONT)
    b.number_format = "@"
    c = sch.cell(row=i, column=3, value=ex)
    c.font = Font(name=FONT, italic=True, color="595959")
    c.fill = example_fill
    c.border = border
    d = sch.cell(row=i, column=4, value=note)
    d.font = Font(name=FONT, color="595959")
    d.alignment = Alignment(wrap_text=True)
    if f.startswith("Require every child"):
        yesno.add(f"B{i}")
sch.freeze_panes = "A2"

sheet("Admin Users", [
    ("Full Name", True, 26, "Staff member who will use the admin dashboard.", None),
    ("Email", True, 32, "Their login. Must be unique.", None),
    ("Mobile", False, 18, "+91 format.", None),
    ("Role", True, 22, "Super Admin: everything incl. users and settings.\nTransport Manager: buses, routes, crew, CCTV.\nOffice Staff: students, parents, attendance.\nViewer: read-only.",
     ["Super Admin", "Transport Manager", "Office Staff", "Viewer"]),
    ("Designation", False, 22, "e.g. Principal, Transport In-charge.", None),
], ["Priya Raman", "priya.raman@school.edu.in", "+91 9876543210", "Transport Manager", "Transport In-charge"], small)

sheet("Buses", [
    ("Bus No", True, 10, "Short number painted on the bus, e.g. 12. Unique. Used to link other tabs.", None),
    ("Registration No", True, 18, "Number plate, e.g. TS 09 UB 1234.", None),
    ("Seating Capacity", True, 12, "Number of student seats.", None),
    ("Make / Model", False, 20, None, None),
    ("Year", False, 8, "Year of manufacture.", None),
    ("Ownership", False, 14, None, ["School-owned", "Contracted", "Leased"]),
    ("GPS Tracker Fitted?", False, 12, None, ["Yes", "No"]),
    ("Tracker IMEI / LivePin Vehicle ID", False, 24, "Printed on the device or in your LivePin account.", None),
    ("Dashcam Channels", False, 12, "Number of camera channels on the tracker (0 if none).", None),
    ("CCTV Camera Positions", False, 30, "Comma separated, e.g. Cabin, Front door, Rear.", None),
    ("Notes", False, 30, None, None),
    ("Route Code", True, 10, "Short code for this bus's route, e.g. R1.", None),
    ("Route Name", True, 26, "e.g. Kondapur → School.", None),
    ("Zone / Area", False, 14, None, None),
    ("Runs", False, 18, None, ["Morning and Evening", "Morning only", "Evening only"]),
] + [
    (f"Stop {n}", n == 1, 22,
     ("Stops in morning pickup order: Stop 1 is the first pickup. Leave the rest blank. "
      "Pick from the Stops tab, so add a stop there first." if n == 1 else None),
     "=Stops!$A$3:$A$1002")
    for n in range(1, MAX_STOPS + 1)
], ["12", "TS 09 UB 1234", "40", "Tata Starbus", "2022", "School-owned", "Yes", "865432109876543", "2",
    "Cabin, Front door", "", "R1", "Kondapur → School", "West", "Morning and Evening",
    "Kondapur Main Road", "Botanical Garden", "Kothaguda Junction", "Hitech City MMTS"]
   + [""] * (MAX_STOPS - 4), small)

sheet("Crew", [
    ("Full Name", True, 24, None, None),
    ("Role", True, 12, None, ["Driver", "Attendant"]),
    ("Mobile", True, 18, "+91 format. Crew sign in on this phone.", None),
    ("Staff ID", False, 14, "Your existing employee ID, if any. Otherwise we generate one.", None),
    ("Assigned Bus No", False, 12, "Must match a Bus No on the Buses tab.", "=Buses!$A$3:$A$202"),
    ("Driving Licence No", False, 22, "Drivers only.", None),
    ("Licence Expiry (DD-MM-YYYY)", False, 16, "Drivers only.", None),
    ("Police Verification Done?", False, 14, None, ["Yes", "No", "In progress"]),
    ("Emergency Contact", False, 22, "Name and +91 number.", None),
], ["Ravi Kumar", "Driver", "+91 9123456780", "EMP-0142", "12", "TS0920190012345", "15-08-2029", "Yes", "Lakshmi, +91 9000011111"], small)

sheet("Stops", [
    ("Stop Name", True, 26, "Unique. Used on the Buses, Stop Timings and Students tabs.", None),
    ("Landmark", False, 28, "Something the driver and parent both recognise.", None),
    ("Google Maps Link or Lat, Lng", False, 36, "Strongly recommended: lets us show the stop on the map and predict arrival.", None),
    ("Area / Locality", False, 18, None, None),
], ["Kondapur Main Road", "Opp. Sarath City Mall", "17.4645, 78.3649", "Kondapur"])

sheet("Stop Timings", [
    ("Bus No", True, 10, "Must match the Buses tab.", "=Buses!$A$3:$A$202"),
    ("Stop Name", True, 26, "One row per stop listed against that bus on the Buses tab.", "=Stops!$A$3:$A$1002"),
    ("Morning Pickup Time (HH:MM)", True, 14, "24-hour.", None),
    ("Evening Drop Time (HH:MM)", True, 14, "24-hour.", None),
], ["12", "Kondapur Main Road", "07:05", "16:20"])

sheet("Students", [
    ("Admission / Roll No", True, 16, "Unique per student. We use it to match records and avoid duplicates.", None),
    ("Full Name", True, 26, None, None),
    ("Grade", True, 10, "e.g. Grade 5, LKG, UKG.", None),
    ("Section", True, 8, "e.g. B.", None),
    ("Gender", False, 10, None, ["Male", "Female", "Other"]),
    ("Bus No", False, 10, "Must match the Buses tab.", "=Buses!$A$3:$A$202"),
    ("Stop Name", False, 26, "Must be one of the stops listed for this bus on the Buses tab.", "=Stops!$A$3:$A$1002"),
    ("Uses Bus", False, 18, None, ["Both ways", "Morning only", "Evening only"]),
    ("Medical Notes / Allergies", False, 28, "Shown to the attendant. Leave blank if none.", None),
    ("Photo File Name", False, 18, "Optional. Send photos in a zip named by Admission No.", None),
], ["SPS-2024-0158", "Aarav Sharma", "Grade 5", "B", "Male", "12", "Kondapur Main Road", "Both ways", "Peanut allergy", "SPS-2024-0158.jpg"])

sheet("Parents", [
    ("Student Admission / Roll No", True, 18, "Must match the Students tab. For siblings, add one row per child with the same mobile.", "=Students!$A$3:$A$1002"),
    ("Parent Full Name", True, 24, None, None),
    ("Mobile", True, 18, "+91 format. This is their login (one-time code by SMS).", None),
    ("Relation", True, 12, None, ["Father", "Mother", "Guardian", "Grandparent", "Other"]),
    ("Primary Contact?", True, 10, "One primary contact per student.", ["Yes", "No"]),
    ("Email", False, 28, None, None),
    ("Preferred Language", False, 14, None, ["English", "Hindi", "Telugu", "Tamil", "Kannada", "Other"]),
    ("Authorised for Pickup?", False, 12, "Can collect the child at the stop.", ["Yes", "No"]),
], ["SPS-2024-0158", "Neha Sharma", "+91 9988776655", "Mother", "Yes", "neha.sharma@gmail.com", "English", "Yes"], 2000)

sheet("Documents", [
    ("For", True, 12, None, ["Bus", "Driver", "Attendant"]),
    ("Bus No / Crew Name", True, 22, "Bus No from Buses tab, or the person's name from Crew tab.", None),
    ("Document Type", True, 22, None, ["RC", "Insurance", "Fitness Certificate", "Permit", "PUC", "Speed Governor",
                                         "Driving Licence", "Police Verification", "Medical Certificate"]),
    ("Document No", False, 20, None, None),
    ("Issued On (DD-MM-YYYY)", False, 14, None, None),
    ("Expires On (DD-MM-YYYY)", True, 14, "We send reminders before expiry.", None),
    ("File Name", False, 24, "Send scans/PDFs in a zip with these file names.", None),
], ["Bus", "12", "Insurance", "POL-3344556", "01-04-2026", "31-03-2027", "bus12-insurance.pdf"])

# Keep Bus No in view while scrolling across the stop columns
wb["Buses"].freeze_panes = "B3"

# Fix sheet order: Instructions, School first
order = ["Instructions", "School", "Admin Users", "Stops", "Buses", "Stop Timings", "Crew",
         "Students", "Parents", "Documents"]
wb._sheets = [wb[n] for n in order]

wb.save(OUT)
print("saved", OUT)
