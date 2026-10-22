# Luxury Finance App — Design System

**Design direction:** Midnight Emerald + Champagne Gold  
**Platform:** Mobile app  
**Product focus:** Personal budgeting, expense tracking, and savings  
**Themes:** Light, dark, and system

---

## 1. Brand principles

- **Premium, not flashy:** use restrained gold accents and generous whitespace.
- **Clarity first:** financial figures should be easy to scan and compare.
- **Consistent meaning:** semantic colors retain the same meaning across screens and themes.
- **Accessible:** never rely on color alone to communicate financial status.
- **Mobile-first:** design for one-handed use, readable amounts, and clear navigation.

## 2. Core brand palette

| Name | Hex | Intended use |
|---|---|---|
| Midnight Pine | `#0B1513` | Dark-mode app background and deep brand surfaces |
| Heritage Emerald | `#176B50` | Primary brand color in light mode |
| Emerald Pressed | `#10533E` | Pressed primary actions in light mode |
| Emerald Light | `#65C49A` | Primary brand color in dark mode |
| Emerald Pressed Dark | `#8BD6B0` | Pressed primary actions in dark mode |
| Champagne Gold | `#D6B879` | Premium accents, milestones, target markers |
| Gold Text | `#8D6A2F` | Gold-colored text on light surfaces |
| Ivory Silk | `#F6F3EB` | Light-mode app background |
| Forest Slate | `#202B27` | Elevated dark-mode surfaces |
| White | `#FFFFFF` | Light-mode cards |
| Main Text Light | `#17231D` | Primary text in light mode |
| Main Text Dark | `#F3F5F1` | Primary text in dark mode |

**Gold usage rule:** use gold sparingly for highlights, savings milestones, premium details, and chart target lines. Do not use it for every button or every chart.

## 3. Theme tokens

| Token | Light mode | Dark mode |
|---|---|---|
| `background` | `#F6F3EB` | `#0B1513` |
| `surface` | `#FFFFFF` | `#15211D` |
| `surface-elevated` | `#F0EDE4` | `#202B27` |
| `text-primary` | `#17231D` | `#F3F5F1` |
| `text-secondary` | `#657168` | `#AAB8B0` |
| `brand-primary` | `#176B50` | `#65C49A` |
| `brand-pressed` | `#10533E` | `#8BD6B0` |
| `accent-gold` | `#8D6A2F` | `#D6B879` |
| `border` | `#E3E0D6` | `#304039` |
| `input-background` | `#F0EDE4` | `#202B27` |
| `overlay` | `#17231D` at 40% opacity | `#000000` at 55% opacity |

Use a separate surface color for cards instead of simply inverting the light palette. Dark mode should use green-black backgrounds rather than pure black.

## 4. Semantic colors

| Meaning | Light mode | Dark mode | Use |
|---|---|---|---|
| Income / positive | `#16805D` | `#65C49A` | Income received, positive cash flow |
| Expense / negative | `#C84B50` | `#F08080` | Expenses and negative amounts |
| Savings | `#176B50` | `#65C49A` | Savings contributions and progress |
| Warning | `#A66A12` | `#E9B765` | Budget approaching its limit |
| Overspending / error | `#B42332` | `#FF858B` | Budget exceeded, destructive-action errors |
| Information | `#4569B0` | `#91B5FF` | Notices, informational states |
| Disabled | `#A8AEA9` | `#68766E` | Disabled controls and unavailable actions |

Do not treat savings as income in financial calculations. Transfers between a user's own accounts should not automatically count as expenses.

## 5. Typography

### Recommended font family

**Primary recommendation: Inter**

- Use **Inter** for headings, body text, labels, buttons, and financial figures.
- Prefer the font's **tabular numerals** for balances, totals, tables, and aligned amounts.
- Platform alternatives: **SF Pro** on iOS, **Roboto** on Android, and **Noto Sans** where broad multilingual/Nepali support is needed.
- If Nepali text is supported, test Devanagari glyphs and numerals on real devices; use a compatible fallback such as Noto Sans Devanagari if necessary.

### Type scale and hierarchy

| Level | Suggested size | Weight | Line height | Typical use |
|---|---:|---|---:|---|
| Display / main balance | 32 px | Bold (700) | 40 px | Main available balance on dashboard |
| H1 / screen title | 28 px | Semibold (600) | 36 px | Main screen heading |
| H2 / section title | 22 px | Semibold (600) | 30 px | Monthly spending, savings goals |
| H3 / card title | 18 px | Semibold (600) | 26 px | Budget cards and section subheads |
| H4 / emphasized amount | 16 px | Semibold (600) | 24 px | Transaction amounts and key values |
| Body large | 16 px | Regular (400) | 24 px | Main explanatory text |
| Body | 14 px | Regular (400) | 20 px | Transaction names and descriptions |
| Label | 12 px | Medium (500) | 16 px | Field labels, chart labels, metadata |
| Caption | 11 px | Regular (400) | 16 px | Secondary timestamps and helper text |
| Button | 15–16 px | Semibold (600) | 20–24 px | Primary and secondary actions |

Sizes are starting points for a mobile interface. Support system text scaling and avoid making important information depend on tiny captions.

### Typography rules

1. Use no more than three weights on a typical screen: Regular 400, Medium 500, and Semibold 600. Reserve Bold 700 for the main balance or rare emphasis.
2. Use sentence case for screen titles and buttons.
3. Use tabular numerals for financial amounts so digits do not shift when values update.
4. Align currency symbols and amounts consistently.
5. Use secondary text for dates and supporting information, not for important warnings.
6. Avoid all-caps headings except for very small, optional eyebrow labels.
7. Keep long transaction descriptions at 14 px or larger where possible.
8. Let users increase text size without clipping amounts or hiding actions.

## 6. Spacing and layout

Use a **4 px spacing scale**:

`4, 8, 12, 16, 20, 24, 32, 40 px`

| Element | Recommendation |
|---|---|
| Screen horizontal padding | 20 px (16 px on compact screens if necessary) |
| Between major sections | 24–32 px |
| Card internal padding | 16–20 px |
| Gap between related elements | 8–12 px |
| Card-to-card gap | 12–16 px |
| Minimum touch target | 44 × 44 px; prefer 48 × 48 px |
| Standard input height | 48–52 px |
| Primary button height | 52 px |
| Standard card radius | 16 px |
| Summary card radius | 20 px |
| Button/input radius | 12–14 px |
| Progress bar height | 6–8 px |

## 7. Component styling

| Component | Style |
|---|---|
| Primary button | Brand fill, high-contrast text, 12–14 px radius, 52 px height |
| Secondary button | Transparent or surface fill, subtle border |
| Summary/balance card | Deep green surface, 20 px radius, 20–24 px padding |
| Standard card | Surface color, 1 px border, 16 px radius, minimal shadow |
| Text field | Surface/elevated background, 1 px border, 12–14 px radius |
| Selected navigation | Brand color icon and label; subtle selected background if needed |
| Bottom navigation | Four main destinations; account for device safe area |
| Floating add button | Brand fill, plus icon, restrained elevation |
| Premium badge | Muted gold background, dark gold text in light mode |
| Destructive action | Semantic danger color and confirmation where appropriate |
| Modal / bottom sheet | Clear title, rounded top corners, visible close/dismiss action |
| Progress indicator | Brand green; gold only for goals or milestones |

Avoid heavy shadows, excessive gradients, glossy effects, and decorative animations. Use subtle transitions of approximately 150–220 ms.

## 8. Chart system

| Chart purpose | Color |
|---|---|
| Income series | `#176B50` light / `#65C49A` dark |
| Expense series | `#C84B50` light / `#F08080` dark |
| Savings / goal progress | `#8D6A2F` light / `#D6B879` dark, or brand green for the progress fill |
| Essentials category | `#176B50` |
| Lifestyle category | `#D6B879` |
| Transport category | `#6486A4` |
| Subscriptions category | `#8B78B8` |
| Other category | `#A7B4AC` |
| Gridlines | Theme border color |
| Axis / secondary labels | Theme secondary text color |

Chart rules:
- Keep the same category color across all charts and reports.
- Use restrained colors and avoid rainbow palettes.
- Keep gridlines subtle and remove unnecessary borders.
- Label axes, units, and date ranges.
- Provide values or accessible summaries; do not use color alone to convey meaning.
- Ensure chart colors contrast with the active theme.

## 9. Dashboard hierarchy

Recommended home-screen order:

1. **Header:** greeting or screen title, period selector, profile/notifications.
2. **Available balance card:** main balance in 32 px bold; optional hide/show balance control.
3. **Income and expenses:** two clearly labeled summary values.
4. **Budget status:** total budget, amount spent, amount remaining, and progress bar.
5. **Savings goal:** goal amount, current progress, target date, and milestone.
6. **Recent transactions:** category icon, name, date, and signed amount.
7. **Bottom navigation:** Home, Activity, Insights, Goals.

The first screen should answer:
- How much money is available?
- How much has been spent?
- How much budget remains?
- Am I on track for my savings goal?

Only label money as **“safe to spend”** when the calculation accounts for planned bills, upcoming obligations, and any other amounts reserved by the app.

## 10. Navigation and interaction

Recommended bottom navigation:
- **Home** — financial overview and quick actions.
- **Activity** — transaction history, search, and filters.
- **Insights** — spending trends and reports.
- **Goals** — savings targets and progress.

Place settings, accounts, categories, and exports in secondary navigation or the profile area.

Support Light, Dark, and System theme choices. Preserve the selected preference between sessions. Use visible focus, pressed, disabled, loading, empty, error, and success states.

## 11. Accessibility and financial clarity

- Target WCAG AA contrast: 4.5:1 for normal text and 3:1 for large text and meaningful interface graphics.
- Do not use light champagne gold for small text on ivory; use the darker gold text token.
- Include labels/icons alongside semantic colors.
- Support screen readers, dynamic text sizing, and keyboard/accessibility navigation where applicable.
- Use explicit signs or labels for income and expenses.
- Provide confirmation and undo for transaction deletion where practical.
- Include a balance privacy toggle and mask sensitive amounts when requested.
- Keep warnings understandable and actionable.

## 12. Quick implementation checklist

- [ ] Centralize colors as design tokens.
- [ ] Implement light, dark, and system theme modes.
- [ ] Use Inter with a tested fallback stack.
- [ ] Apply tabular numerals to financial values.
- [ ] Use consistent currency formatting for the selected locale.
- [ ] Keep emerald as the primary action color and gold as a restrained accent.
- [ ] Define semantic colors for income, expenses, savings, warnings, and errors.
- [ ] Test text and chart contrast in both themes.
- [ ] Verify layouts with large text and long currency values.
- [ ] Test Nepali/Devanagari text if the app supports it.

---

**Final direction:** Midnight Pine + Heritage Emerald + Champagne Gold + Ivory Silk. The result should feel private, calm, premium, and trustworthy—with financial clarity taking priority over decoration.
