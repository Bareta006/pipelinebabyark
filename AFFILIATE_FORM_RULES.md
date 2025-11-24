# Affiliate Landing Form Section - Development Rules

## Purpose
Handle referral links with base64-encoded data and collect email addresses for discount distribution.

## URL Format
`https://babyark.com/pages/referral?info={base64_encoded_string}`

## Base64 Content Format
`{coupon}-{userName}-{discountAmount}`

Example: `x4ofqz-Dudek-100` → base64: `eDRvZnF6LUR1ZGVrLTEwMA==`

## Technical Requirements

### 1. Liquid (Server-Side)
- **Get URL Parameter**: Use `request.params.info` to get the `?info=` parameter
- **Data Attributes**: Pass all data to JavaScript via `data-*` attributes on section element
- **Initial State**: Show "Loading..." if param exists, error if blank
- **CSS Variables**: All styling via CSS custom properties set inline

### 2. JavaScript (Client-Side)
- **DOM Ready**: Must wait for DOMContentLoaded or check readyState
- **Read URL Parameter**: Use `URLSearchParams(window.location.search).get('info')` directly
- **Base64 Decode**: Use `atob()` with proper URL-safe handling and padding
- **Parse Data**: Split by `-`, first part = coupon, last part = discount, middle = userName
- **Render Form**: Create HTML dynamically with welcome message and form (fullName + email inputs)
- **Form Submission**: 
  - Validate fullName and email
  - Send POST to webhook with `mode: 'no-cors'` (CORS blocked by Shopify preview domain)
  - Body: JSON string `{"code": "...", "refereeName": "...", "refereeEmail": "..."}`
  - No try/catch - keep it simple
  - Redirect immediately after fetch call

### 3. Error Handling
- No `info` parameter → Show error message
- Invalid base64 → Show decode error
- Invalid format → Show parse error
- Form validation → Show error for empty fullName or invalid email
- **Keep it simple** - No complex error handling for webhook (fire and forget)

### 4. Flow
1. Page loads → Liquid gets `?info=` param (for initial state)
2. JavaScript waits for DOM ready
3. JavaScript reads `info` parameter directly from URL using `URLSearchParams`
4. JavaScript decodes base64
5. JavaScript parses `{coupon}-{userName}-{discountAmount}`
6. JavaScript renders welcome message + form (fullName + email inputs)
7. User submits form → Validate → POST webhook (no-cors mode) → Redirect immediately

### 5. Critical Rules
- **NO conditional CSS** - Use CSS variables only
- **KEEP IT SIMPLE** - Minimal code, no overcomplication
- **Minimal JavaScript** - Only for base64 decode and form handling
- **Proper DOM ready** - Always check before accessing elements
- **CORS Issue** - Use `mode: 'no-cors'` for fetch (Shopify preview blocks CORS)
- **Simple webhook** - Just send JSON and redirect, no complex error handling
- **Debug mode** - Show decoded/parsed data when enabled

## Schema Settings Required
- `webhook_url` (url) - Webhook endpoint
- `redirect_url` (text) - Redirect destination after success
- `message_size` (range) - Welcome message font size
- `message_color` (color) - Welcome message color
- `form_text_size` (range) - Form text size
- `text_color_custom` (color) - Form text color
- `button_color` (color) - Button background
- `button_text_color` (color) - Button text
- `text_alignment` (select) - Text alignment
- `width` (select) - Section width
- `text_color` (select) - Theme text color class
- `padding_top` (range) - Top padding
- `padding_bottom` (range) - Bottom padding
- `show_debug` (checkbox) - Debug mode

## Webhook Data Format
```json
{
  "code": "x4ofqz",
  "refereeName": "John Doe",
  "refereeEmail": "john@example.com"
}
```

## Implementation Notes
- **CORS**: Shopify preview domains block CORS, so use `mode: 'no-cors'` in fetch
- **Simple**: No try/catch, no complex error handling - just send and redirect
- **Form Fields**: fullName (required) and email (required, validated)
- **Redirect**: `/discount/{coupon}?redirect={redirect_url}`

## Testing Checklist
- [ ] URL with `?info=` parameter loads correctly
- [ ] Base64 decodes properly
- [ ] Data parses correctly (coupon, userName, discountAmount)
- [ ] Welcome message displays with correct values
- [ ] Form renders correctly with fullName and email fields
- [ ] FullName validation works (required)
- [ ] Email validation works (regex check)
- [ ] Webhook POST sends correct JSON data
- [ ] Webhook receives data at webhook.site (check raw body)
- [ ] Redirect works after form submission
- [ ] Error messages show for validation failures
- [ ] Debug mode shows decoded/parsed data

