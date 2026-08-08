Docker build & run

Build the image (on a machine with Docker installed):

```bash
docker build -t campushub:ci .
```

Run the container (will start the built Next.js app):

```bash
docker run --rm -p 3000:3000 \ 
  -e NEXT_PUBLIC_SUPABASE_URL="https://<your-supabase>.supabase.co" \
  -e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="<anon-key>" \
  -e NEXT_PUBLIC_APP_URL="http://localhost:3000" \
  campushub:ci
```

Notes:
- The container runs `npm ci`, `npm run build`, and `npm start`. Use CI (GitHub Actions) to run checks without local toolchain.
