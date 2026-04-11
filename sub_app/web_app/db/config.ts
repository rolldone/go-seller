import { column, defineDb, defineTable, NOW } from "astro:db";

const BusinessCarousel = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    businessId: column.text(),
    slot: column.text(),
    title: column.text(),
    subtitle: column.text({ optional: true }),
    layoutType: column.text({ enum: ["large", "medium", "banner"] }),
    isActive: column.boolean({ default: true }),
    sortOrder: column.number({ default: 0 }),
    items: column.json(),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
  indexes: [{ on: ["businessId", "slot"] }, { on: ["businessId", "sortOrder"] }],
});

export default defineDb({
  tables: {
    BusinessCarousel,
  },
});