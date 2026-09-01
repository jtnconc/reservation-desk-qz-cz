# Reservation Desk

Build a web application called **Reservation Workspace** from scratch.

This is a reservation agent workspace, not a traditional dashboard, CRM or productivity app.

The application must feel like a **personal digital desk for working with hotel reservations**, inspired by the simplicity, spatial organization and fluidity of Apple interfaces.

The core interaction principle is:

**“Don’t open. Transform.”**

There should be no traditional sidebar, no unnecessary pages, no modal-heavy workflow and no separate windows for normal actions.

The workspace itself changes composition depending on what the user is working on.

---

# 1. TYPOGRAPHY

Use these exact fonts:

### Plus Jakarta Sans

Primary interface font:

* labels
* buttons
* navigation
* widget titles
* notes
* forms
* general content

### Bricolage Grotesque

Use ONLY for the main application title:

**Reservation Workspace**

### Spline Sans Mono

Use for:

* reservation numbers
* confirmation codes
* prices
* monetary values
* technical numeric information
* rate calculations
* calculator content

Do not replace these fonts with Inter, Geist, system-ui or generic fonts.

---

# 2. OVERALL VISUAL STYLE

Create a premium, minimal, calm interface.

Use:

* white / very light neutral background
* subtle 1px borders
* soft shadows
* rounded corners
* generous whitespace
* restrained colors
* compact controls
* smooth transitions
* clean typography

Avoid:

* traditional SaaS dashboard appearance
* sidebar navigation
* large hero sections
* excessive cards
* excessive headings
* excessive explanatory text
* large gradients
* dark dashboard layouts
* unnecessary modals

The interface should feel like a **professional reservation desk**, not an administration system.

---

# 3. HEADER

Create a compact header at the top.

Left:

**Reservation Workspace**

Use Bricolage Grotesque.

Right:

* Search
* Notifications
* Plus / Add

The header should remain visually simple.

The Plus button will later add Workspace widgets.

---

# 4. THE WORKSPACE HAS TWO GLOBAL STATES

This is the most important architectural requirement.

Do NOT treat every card as an independent expanding card.

The entire Workspace has two global modes:

### TOOL MODE

One of the main tools is active:

* Notes
* Quote
* Rates

In this mode:

**The active tool is large.**

All Workspace widgets below are minimized.

### WIDGET MODE

One of the Workspace widgets is active.

In this mode:

**The tool section retracts/minimizes.**

All widgets become visible in their configured grid sizes.

This must be controlled by a global Workspace state.

Conceptually:

activeMode = "tool"

activeTool = "notes" | "quote" | "rates"

OR

activeMode = "widgets"

activeWidget = "reminders" | "contacts" | "notes" | "information" | "task"

Do not implement expansion as an independent card resize.

The entire layout must respond to the global state.

---

# 5. MAIN TOOLS

At the top of the Workspace create:

**NOTES | QUOTE | RATES**

These are not traditional page navigation tabs.

They are three tools inside the same Workspace.

Clicking a tool changes the Workspace composition without navigating to another page.

---

# 6. TOOL MODE

When Notes, Quote or Rates is active:

The selected tool occupies the main workspace area.

The widgets below become minimized.

Each minimized widget shows ONLY:

* icon
* title

Example:

[ icon REMINDERS ]

[ icon CONTACTS ]

[ icon NOTES ]

[ icon INFORMATION ]

No widget content should be visible while minimized.

The widgets should remain accessible and clickable.

---

# 7. WIDGET MODE

When the user clicks one of the minimized widgets:

The tool section retracts.

The widgets become expanded according to their configured grid size.

This is NOT a modal.

This is NOT a new page.

This is a transformation of the same workspace.

Example:

TOOL MODE:

Large Notes

[ Reminders ][ Contacts ][ Information ]

WIDGET MODE:

Retracted tool area

[ large Reminders ][ Contacts ]

[ large/vertical Information ][ other widget ]

The transition should be smooth and spatial.

---

# 8. WIDGET GRID SYSTEM

Use a controlled grid inspired by the organization of widgets on iOS.

Use a **4-column grid**.

Each widget has ONLY three possible expanded sizes:

### 1 × 1

One grid column and one grid row.

### 1 × 2

One column and two rows vertically.

### 2 × 1

Two columns and one row horizontally.

Do NOT allow 2 × 2.

Do NOT allow arbitrary infinite resizing.

Do NOT create an infinite canvas like Figma or Miro.

Widgets can be moved and reorganized within the controlled grid.

The user can configure their preferred position and size.

---

# 9. WIDGET STATES

Each widget has only two visual states:

### MINIMIZED

Shows only:

icon + title

### EXPANDED

Shows its configured grid size:

1×1
1×2
2×1

Do not create additional card expansion states.

The widget's configured size must remain stored even when the widget is minimized.

Example:

Reminder:
size = 1×2

When minimized:

[ icon REMINDERS ]

When Widget Mode becomes active:

[ tall 1×2 Reminders widget ]

---

# 10. WORKSPACE WIDGETS

Create these initial widgets:

* Reminders
* Contacts
* Notes
* Information
* Tasks

Use realistic placeholder content.

The widgets must be reusable components.

Each widget should have:

* id
* type
* position
* width
* height
* display state
* content

Keep this architecture flexible for future widgets such as:

* calculator
* itinerary
* reservation
* flight
* hotel
* transfer

---

# 11. NOTES TOOL

Notes is the default active tool.

Notes must always be immediately ready for writing.

Do not require clicking “New Note”.

Create a large, elegant writing area.

Example:

“Carlos Morales arrives August 24 and leaves August 30.
Reservation 21114.
Send quotation tomorrow.
[carlos@email.com](mailto:carlos@email.com)”

The user should be able to type naturally.

Notes should behave like a persistent intelligent scratchpad.

---

# 12. INTELLIGENT NOTES

Prepare the architecture for intelligent text recognition.

The system should recognize:

* names / people
* dates
* reservation numbers
* confirmation codes
* email addresses
* phone numbers
* hotel/property names
* destinations

Use different subtle highlight colors for each entity type.

Example:

Carlos Morales → Person

24 August → Date

21114 → Reservation

[carlos@email.com](mailto:carlos@email.com) → Email

6000-1234 → Phone

For this initial implementation, local/mock parsing is acceptable.

Do not require an external AI API yet.

---

# 13. SAVE INFORMATION FROM NOTES

This is a core feature.

The user can select a piece of text inside Notes.

Show a small contextual action:

**Save as...**

Options:

* Task
* Reminder
* Contact
* Information
* Note

Example:

User writes:

“Send quotation tomorrow.”

They select the sentence.

Choose:

Save as → Task

A Task widget is created using the selected information.

The original note remains unchanged.

Do not force the user to rewrite information.

The philosophy is:

**Write → Recognize → Select → Save → Work**

---

# 14. NOTES HISTORY

Notes must have a History icon.

History allows the user to see previous versions of their notes.

The user must be able to:

* view previous versions
* open a version
* edit it
* restore it

Keep the history interface lightweight and integrated into the Workspace.

Do not use a large modal.

---

# 15. RATES TOOL

Rates is a hotel rate calculator.

Create the rate interface based on the provided visual reference.

The primary initial calculator is the **Jubilado / Senior rate calculator**.

Include:

### ARRIVAL

date input

### DEPARTURE

date input

### REGULAR RATE

date/rate input

Then a summary row:

* RATE PER NIGHT
* TOTAL STAY
* PAX EXTRA
* TOTAL + ITBMS

Then a daily rate table:

DATE | DAY | DISCOUNT | RATE

Example:

2026-08-15 | Sábado | Vie-Dom (-30%) | $114.80

2026-08-16 | Domingo | Vie-Dom (-30%) | $114.80

2026-08-17 | Lunes | Lun-Jue (-50%) | $82.00

The calculation must be dynamic.

Senior discount rules:

Monday–Thursday = 50% discount

Friday–Sunday = 30% discount

Calculate the rate individually for each night.

Use Spline Sans Mono for dates, rates and numerical calculations.

Keep this architecture flexible for additional rate rules later.

---

# 16. QUOTE TOOL

Quote is a quotation generator.

It must NOT simply display a preview card.

It must generate a structured quotation document that can be exported as a **real PDF**.

Use the provided quotation image as the visual reference for the first hotel template.

The quotation should include:

* hotel logo
* issue date
* recipient
* company
* introductory text
* quotation title
* accommodation table
* subtotal
* optional ITBMS
* total
* included services
* hotel information
* check-in
* check-out
* closing/signature

---

# 17. QUOTE RECIPIENT

The quotation must allow the user to specify:

### Recipient

Example:

Jhaelen Miranda

### Company

Example:

Biomedical Support

These fields must be editable.

The generated document should use them in the appropriate places.

---

# 18. AUTOMATIC QUOTE DESCRIPTION

The accommodation description should be generated automatically from reservation information.

Use:

* arrival date
* departure date
* guest name
* number of rooms
* room type
* number of nights
* meal plan
* number of guests

Example generated description:

“Habitación con desayuno para 1 persona del 26 al 27 de julio de 2026”

The generated description must remain editable.

The system should generate it initially, but the user can modify it before exporting.

---

# 19. QUOTE TABLE

Create a structured table with:

DESCRIPTION
NAME
ROOMS / HAB
ROOM TYPE
RN
P/U
SUB TOTAL

Example:

Description:
Habitación con desayuno para 1 persona del 26 al 27 de julio de 2026

Name:
Por confirmar

HAB:
9

Room type:
Loft - cama king

RN:
1

P/U:
$113.00

Subtotal:
$1,017.00

All calculations must be dynamic.

---

# 20. ITBMS

ITBMS must be optional.

Provide a clear toggle:

ITBMS [ ON / OFF ]

When ON:

Subtotal
+ 10% ITBMS
= Total

When OFF:

Subtotal
= Total

Do not hard-code the tax into every quotation.

---

# 21. QUOTE TEMPLATE

The quotation must visually resemble the supplied reference document.

Include:

* hotel logo
* date
* recipient
* company
* introductory paragraph
* “Cotización de Hospedaje”
* accommodation table
* tax
* total
* included services
* hotel information
* check-in / check-out
* signature

The text should be editable.

The included-services section should be editable.

The introductory paragraph should be editable.

The signature information should be editable.

---

# 22. THREE HOTELS

The application will eventually support three different hotels.

Do NOT assume that all hotels use exactly the same quotation.

Create a hotel/template architecture.

Each hotel should be able to have its own:

* logo
* hotel name
* address
* introductory text
* included services
* check-in time
* check-out time
* tax configuration
* signature
* quotation layout
* document content

For now, implement the first hotel using the provided quotation reference.

Keep the architecture ready for the other two hotels to be added later.

Do NOT force all hotels into a single fixed template.

---

# 23. REAL PDF GENERATION

This is mandatory.

Quote must be able to generate and download a **real PDF document**.

Do NOT generate a screenshot of the quotation.

Do NOT convert the UI into an image and place it inside a PDF.

The PDF must contain real structured text, tables, images/logo and selectable content.

The generated PDF should preserve:

* typography
* spacing
* logo
* table structure
* totals
* text
* page layout

The PDF should be suitable for sending to a client.

Keep PDF generation isolated from the visual UI so the quotation template can evolve independently from the Workspace interface.

Add a clear action such as:

**Generate PDF**

---

# 24. QUOTE HISTORY

Quote must have a History icon.

The user should be able to access previous quotations.

History should allow:

* view previous quotation
* edit
* duplicate
* restore
* regenerate PDF

A quotation should not be lost when the user creates a new version.

---

# 25. EDITABLE QUOTATIONS

The user must be able to edit:

* recipient
* company
* dates
* guest
* room count
* room type
* nights
* rate
* description
* introductory text
* included services
* ITBMS
* signature information

Calculated values should update automatically.

For example:

P/U × HAB × RN = Subtotal

ITBMS = Subtotal × 10%

Total = Subtotal + ITBMS

---

# 26. PLUS BUTTON

The top-right Plus button should eventually create Workspace widgets.

Options:

* Reminder
* Contact
* Information
* Task
* Note

Do not open a large modal.

Use a small contextual menu.

---

# 27. IMPORTANT INTERACTION RULES

These rules must be treated as architectural requirements.

### RULE 1

When Notes, Quote or Rates is active:

**Tool = expanded**

**Widgets = minimized**

### RULE 2

When a widget is clicked:

**Tool = minimized**

**Widgets = expanded according to their configured grid sizes**

### RULE 3

Widgets have only two states:

MINIMIZED

EXPANDED

### RULE 4

Expanded widgets have only three sizes:

1×1

1×2

2×1

### RULE 5

The tool and widget areas never open in separate pages.

### RULE 6

Do not use modals for normal Workspace interactions.

### RULE 7

The Workspace changes composition as a whole.

Do not make cards independently expand without respecting the global Workspace state.

---

# 28. DATA ARCHITECTURE

Use clean reusable components and a scalable data model.

Separate:

### Workspace state

Which tool/widget is active.

### Widget configuration

Position and size.

### Notes

Text and history.

### Contacts

People and contact information.

### Tasks

Tasks and status.

### Reminders

Reminder information and dates.

### Rates

Rate rules and calculations.

### Quotes

Quotation data and versions.

### Hotels

Hotel-specific quotation configuration.

Do not build unnecessary complexity yet, but structure the application so these systems can grow independently.

---

# 29. FIRST VERSION PRIORITY

The priority order is:

1. Workspace layout and global state system
2. Tool/widget transformation behavior
3. 4-column widget grid
4. Widget positioning and 1×1 / 1×2 / 2×1 configuration
5. Notes
6. Intelligent Notes visual recognition
7. Notes history
8. Rates calculator
9. Quote generator
10. Quote history
11. Real PDF generation

Do not sacrifice the Workspace interaction model in order to add more features.

The spatial behavior is the foundation of the application.

---

# 30. FINAL PRODUCT FEEL

Reservation Workspace should feel like:

**A digital reservation desk that adapts to the task currently being performed.**

Not a dashboard.

Not a CRM.

Not a spreadsheet.

Not a collection of independent cards.

The user should feel that they have one workspace that continuously transforms around their work.

Core philosophy:

**Write something.**

**Workspace understands it.**

**Turn information into an object.**

**Work with that object.**

**Generate the reservation quotation when needed.**

**Return to the same workspace without losing context.**

Build the first version with clean reusable components and a strong separation between UI, workspace state, data and document generation.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/399bdeb7-0398-469f-b832-3ab618020a56).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
