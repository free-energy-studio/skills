# Twilio CLI Command Cookbook

## Contents

1. Profiles and authentication
2. Phone numbers
3. Messaging
4. Calls
5. Messaging services
6. Output and automation tips

## Profiles and authentication

### Create or replace a named profile

```bash
twilio profiles:create ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --auth-token YOUR_AUTH_TOKEN \
  --profile work \
  --force
```

### Inspect configured profiles

```bash
twilio profiles:list
```

### Switch active profile

```bash
twilio profiles:use work
```

## Phone numbers

### Quick list

```bash
twilio phone-numbers:list
```

### JSON list with more fields

```bash
twilio api:core:incoming-phone-numbers:list \
  -o json \
  --limit 100
```

### Filter by a partial number

```bash
twilio api:core:incoming-phone-numbers:list \
  --phone-number '*2673' \
  -o json
```

## Messaging

### Send an SMS

```bash
twilio api:core:messages:create \
  --from +15551234567 \
  --to +15557654321 \
  --body 'Hello from Twilio CLI'
```

### Send an MMS

```bash
twilio api:core:messages:create \
  --from +15551234567 \
  --to +15557654321 \
  --body 'See attached' \
  --media-url https://example.com/image.jpg
```

### Send through a Messaging Service

```bash
twilio api:core:messages:create \
  --messaging-service-sid MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --to +15557654321 \
  --body 'Hello from the service'
```

### List recent messages

```bash
twilio api:core:messages:list --limit 20 -o json
```

### Filter recent messages to one recipient

```bash
twilio api:core:messages:list \
  --to +15557654321 \
  --limit 20 \
  --properties sid,from,to,status,dateSent
```

## Calls

### Place a basic outbound call

```bash
twilio api:core:calls:create \
  --from +15551234567 \
  --to +15557654321 \
  --url https://demo.twilio.com/docs/voice.xml
```

### List recent calls

```bash
twilio api:core:calls:list --limit 20 -o json
```

### Filter completed calls from a number

```bash
twilio api:core:calls:list \
  --from +15551234567 \
  --status completed \
  --limit 20 \
  --properties sid,from,to,status,startTime
```

## Messaging services

### List messaging services

```bash
twilio api:messaging:v1:services:list -o json
```

## Output and automation tips

### Prefer JSON

```bash
twilio api:core:messages:list -o json
```

### Reduce output columns in human-readable mode

```bash
twilio api:core:messages:list \
  --properties sid,from,to,status,dateSent
```

### Use a specific profile

```bash
twilio api:core:messages:list -p work -o json
```

### Target a subaccount explicitly

```bash
twilio api:core:messages:list \
  --account-sid ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  -o json
```

### Discover exact flags fast

```bash
twilio api:core:messages:create --help
twilio api:core:calls:create --help
twilio api:messaging:v1:services:list --help
```
