# Redlist And WDPA API

## Redlist

- `GET /api/redlist/threatened-species`
  Query: `page`, `limit`, `category`, `keyword`
- `GET /api/redlist/threatened-species/stats`
  Returns total count, category distribution, and population trend distribution.
- `GET /api/redlist/threatened-species/:id`
  Returns a single threatened species with linked plant and taxon when available.
- `GET /api/redlist/alerts`
  Query: `page`, `limit`, `unreadOnly`

## Protected Areas

- `GET /api/protected-areas`
  Query: `page`, `limit`, `keyword`, `iso3`, `siteType`, `iucnCategory`, `status`, `realm`
- `GET /api/protected-areas/stats`
  Query: `iso3`, `siteType`
  Returns total count plus grouped counts by IUCN category, site type, and realm.
- `GET /api/protected-areas/:siteId`
  Returns a single protected area record.
