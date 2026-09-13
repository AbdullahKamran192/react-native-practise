# Generic product images

The public image base URL is configured in `src/utils/productImage.ts`:
`https://pub-2ca57f48a8a84787af817053917f37a0.r2.dev`.

Upload the image to `foodworth-public-images`, then set that generic product's
`image_path` in Supabase to its exact R2 object key, for example:

```text
generic-products/31.webp
```

An existing root-level file such as `generic_apple.jpg` also works: store that
exact filename. Store the path only, without the bucket name or full URL.

Search, Add to Pantry and Consume Food resolve the path against the public base
URL. Empty paths and failed images use the existing placeholder. Barcode products
continue to use `image_url`; meal images retain their private-image flow.

No additional SQL, keys, Edge Functions or upload controls are needed. The
`generic_products.image_url` to `image_path` rename was already applied manually.
