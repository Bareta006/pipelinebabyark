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
- **Base64 Decode**: Use `atob()` with proper URL-safe handling and padding
- **Parse Data**: Split by `-`, first part = coupon, last part = discount, middle = userName
- **Render Form**: Create HTML dynamically with welcome message and email form
- **Form Submission**: Validate email, send POST to webhook, redirect on success

### 3. Error Handling
- No `info` parameter → Show error message
- Invalid base64 → Show decode error
- Invalid format → Show parse error
- Webhook failure → Show error, re-enable form
- Missing webhook URL → Show configuration error

### 4. Flow
1. Page loads → Liquid gets `?info=` param
2. Liquid sets `data-info-param` attribute
3. JavaScript waits for DOM ready
4. JavaScript reads `data-info-param`
5. JavaScript decodes base64
6. JavaScript parses `{coupon}-{userName}-{discountAmount}`
7. JavaScript renders welcome message + form
8. User submits email → Validate → POST webhook → Redirect

### 5. Critical Rules
- **NO conditional CSS** - Use CSS variables only
- **Minimal JavaScript** - Only for base64 decode and form handling
- **Proper DOM ready** - Always check before accessing elements
- **Error handling** - Every step must have error handling
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

## Testing Checklist
- [ ] URL with `?info=` parameter loads correctly
- [ ] Base64 decodes properly
- [ ] Data parses correctly (coupon, userName, discountAmount)
- [ ] Welcome message displays with correct values
- [ ] Form renders correctly
- [ ] Email validation works
- [ ] Webhook POST sends correct data
- [ ] Redirect works after success
- [ ] Error messages show for all failure cases
- [ ] Debug mode shows decoded/parsed data

