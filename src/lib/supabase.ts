import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: any = null;

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
};

if (
  supabaseUrl && 
  supabaseAnonKey && 
  isValidUrl(supabaseUrl) &&
  !supabaseUrl.includes("your-project-id")
) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
  }
}

// Fallback mock client to prevent rendering crashes on Vercel when environment variables are blank/default
if (!client) {
  console.warn("Supabase keys are missing, invalid, or left as defaults. Operating in local simulation mode.");

  const INITIAL_MENU = [
    { id: "B1", name: "Le Double Face Classic", price: 14.90, category: "Burgers", desc: "Double wagyu patty, truffle mayo, aged cheddar, lettuce, tomato, brioche bun", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop&auto=format", active: true, popular: true, custom_fields: [
      { id: "c1", name: "Cooking", type: "radio", options: ["Saignant", "À point", "Bien cuit"], required: true },
      { id: "c2", name: "Extras", type: "checkbox", options: ["Extra cheese (+€1.00)", "Extra patty (+€3.00)", "Bacon (+€2.00)"], required: false },
      { id: "c3", name: "Sauce", type: "radio", options: ["Truffle Mayo", "BBQ", "Sriracha", "None"], required: false },
    ]},
    { id: "B2", name: "Smash & Burn", price: 13.90, category: "Burgers", desc: "Smash patty, caramelized onion, smoky BBQ, crispy bacon, pickles", image: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&h=300&fit=crop&auto=format", active: true, popular: true, custom_fields: [
      { id: "c1", name: "Cooking", type: "radio", options: ["Saignant", "À point", "Bien cuit"], required: true },
      { id: "c3", name: "Sauce", type: "radio", options: ["BBQ", "Mustard", "Mayo", "None"], required: false },
    ]},
    { id: "D3", name: "Le Cocktail Double Face", price: 12.00, category: "Drinks", desc: "Premium signature cocktail with dual-distilled gin, blood orange, and rosemary syrup", image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&h=300&fit=crop&auto=format", active: true, popular: true, custom_fields: [
      { id: "cf3", name: "Ice Options", type: "radio", options: ["Crushed Ice", "Single Large Cube", "No Ice"], required: true },
      { id: "cf4", name: "Supplements", type: "checkbox", options: ["Extra Truffle Honey (+€3.50)", "Double Shot (+€4.00)"], required: false }
    ]},
    { id: "S1", name: "La Truffe Fries", price: 6.90, category: "Sides", desc: "Belgian fries, black truffle oil, parmesan, fresh herbs", image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop&auto=format", active: true, popular: true, custom_fields: [
      { id: "c5", name: "Size", type: "radio", options: ["Regular", "Large (+€2.00)"], required: true },
    ]}
  ];

  const INITIAL_SHOWS = [
    { id: "s1", title: "Gipsy Kings Tribute Night", description: "Live flamenco night under the Parisian stars. Real fire, real guitars, and authentic tapas experience.", date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), price: 25.00, image: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&h=400&fit=crop&auto=format", available_tickets: 45 },
    { id: "s2", title: "Cabaret Parisien Double Face", description: "A mesmerizing double-act drag & cabaret dinner show detailing history, music, and comedy.", date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(), price: 35.00, image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&h=400&fit=crop&auto=format", available_tickets: 30 }
  ];

  const INITIAL_TABLES = [
    { id: 'T01', area: 'Inside Lounge', is_terrace: false, waiter_called: false },
    { id: 'T02', area: 'Inside Lounge', is_terrace: false, waiter_called: false },
    { id: 'T03', area: 'Inside Lounge', is_terrace: false, waiter_called: false },
    { id: 'T04', area: 'Inside Lounge', is_terrace: false, waiter_called: false },
    { id: 'T05', area: 'Inside Lounge', is_terrace: false, waiter_called: false },
    { id: 'T06', area: 'Inside Lounge', is_terrace: false, waiter_called: false },
    { id: 'T07', area: 'Terrace Patio', is_terrace: true, waiter_called: false },
    { id: 'T08', area: 'Terrace Patio', is_terrace: true, waiter_called: false },
    { id: 'T09', area: 'Terrace Patio', is_terrace: true, waiter_called: false },
    { id: 'T10', area: 'Terrace Patio', is_terrace: true, waiter_called: false },
    { id: 'T11', area: 'Terrace Patio', is_terrace: true, waiter_called: false },
    { id: 'T12', area: 'Terrace Patio', is_terrace: true, waiter_called: false }
  ];

  const INITIAL_HERO = {
    id: "current",
    title1_fr: "Deux Visages.",
    title2_fr: "Une Légende.",
    subtitle_fr: "Saveurs audacieuses rencontrent l'élégance parisienne. Chaque bouchée est un double voyage — l'âme de la rue alliée au savoir-faire gastronomique.",
    title1_en: "Two Faces.",
    title2_en: "One Legend.",
    subtitle_en: "Bold flavors meet Parisian elegance. Every bite is a double experience — street soul with fine dining craft.",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&h=900&fit=crop&auto=format",
    show_in_menu: false
  };

  const getCollection = (key: string, defaultData: any) => {
    if (typeof window === "undefined") return defaultData;
    const raw = localStorage.getItem(`ldf_${key}`);
    if (!raw) {
      localStorage.setItem(`ldf_${key}`, JSON.stringify(defaultData));
      return defaultData;
    }
    try {
      return JSON.parse(raw);
    } catch (_) {
      return defaultData;
    }
  };

  const setCollection = (key: string, data: any) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(`ldf_${key}`, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("ldf-db-update", { detail: { table: key } }));
  };

  const channels = new Set<{ table: string; callback: Function }>();

  if (typeof window !== "undefined") {
    window.addEventListener("ldf-db-update", (e: any) => {
      const table = e.detail.table;
      channels.forEach(ch => {
        if (ch.table === table || ch.table === "*") {
          ch.callback();
        }
      });
    });
    // Support tab-to-tab sync via storage events
    window.addEventListener("storage", (e) => {
      if (e.key && e.key.startsWith("ldf_")) {
        const table = e.key.replace("ldf_", "");
        channels.forEach(ch => {
          if (ch.table === table || ch.table === "*") {
            ch.callback();
          }
        });
      }
    });
  }

  client = {
    from: (tableName: string) => {
      let data = [];
      if (tableName === "menu_items") data = getCollection("menu_items", INITIAL_MENU);
      else if (tableName === "shows") data = getCollection("shows", INITIAL_SHOWS);
      else if (tableName === "restaurant_tables") data = getCollection("restaurant_tables", INITIAL_TABLES);
      else if (tableName === "orders") data = getCollection("orders", []);
      else if (tableName === "order_items") data = getCollection("order_items", []);
      else if (tableName === "tickets") data = getCollection("tickets", []);
      else if (tableName === "hero_config") data = getCollection("hero_config", [INITIAL_HERO]);

      const api = {
        select: (selectQuery = "*") => {
          let result = [...data];
          
          if (tableName === "orders") {
            const items = getCollection("order_items", []);
            result = result.map(o => ({
              ...o,
              order_items: items.filter((item: any) => item.order_id === o.id)
            }));
          } else if (tableName === "tickets") {
            const showsList = getCollection("shows", INITIAL_SHOWS);
            result = result.map(t => ({
              ...t,
              shows: showsList.find((s: any) => s.id === t.show_id)
            }));
          }

          const queryChain = {
            eq: (column: string, value: any) => {
              result = result.filter(row => row[column] === value);
              const chain2 = {
                eq: (col2: string, val2: any) => {
                  result = result.filter(row => row[col2] === val2);
                  return chain2;
                },
                neq: (col2: string, val2: any) => {
                  result = result.filter(row => row[col2] !== val2);
                  return chain2;
                },
                order: () => chain2,
                limit: (limitCount: number) => {
                  result = result.slice(0, limitCount);
                  return Promise.resolve({ data: result, error: null });
                },
                then: (resolve: any) => resolve({ data: result, error: null })
              };
              return chain2;
            },
            neq: (column: string, value: any) => {
              result = result.filter(row => row[column] !== value);
              const chain2 = {
                eq: (col2: string, val2: any) => {
                  result = result.filter(row => row[col2] === val2);
                  return chain2;
                },
                neq: (col2: string, val2: any) => {
                  result = result.filter(row => row[col2] !== val2);
                  return chain2;
                },
                order: () => chain2,
                limit: (limitCount: number) => {
                  result = result.slice(0, limitCount);
                  return Promise.resolve({ data: result, error: null });
                },
                then: (resolve: any) => resolve({ data: result, error: null })
              };
              return chain2;
            },
            order: (column: string, options: any) => {
              const asc = options?.ascending !== false;
              result.sort((a, b) => {
                if (a[column] < b[column]) return asc ? -1 : 1;
                if (a[column] > b[column]) return asc ? 1 : -1;
                return 0;
              });
              const chain2 = {
                then: (resolve: any) => resolve({ data: result, error: null })
              };
              return chain2;
            },
            then: (resolve: any) => resolve({ data: result, error: null })
          };

          return queryChain;
        },

        insert: (payload: any) => {
          const current = [...data];
          if (Array.isArray(payload)) {
            const payloadWithIds = payload.map(row => ({
              id: row.id || `id-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              created_at: row.created_at || new Date().toISOString(),
              ...row
            }));
            current.push(...payloadWithIds);
            setCollection(tableName, current);
            return Promise.resolve({ data: payloadWithIds, error: null });
          } else {
            const row = {
              id: payload.id || `id-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              created_at: payload.created_at || new Date().toISOString(),
              ...payload
            };
            current.push(row);
            setCollection(tableName, current);
            return Promise.resolve({ data: [row], error: null });
          }
        },

        update: (payload: any) => {
          return {
            eq: (column: string, value: any) => {
              const current = [...data];
              const updated = current.map(row => {
                if (row[column] === value) {
                  return { ...row, ...payload };
                }
                return row;
              });
              setCollection(tableName, updated);
              return Promise.resolve({ data: updated.filter(row => row[column] === value), error: null });
            }
          };
        },

        upsert: (payload: any) => {
          const current = [...data];
          const rows = Array.isArray(payload) ? payload : [payload];
          
          rows.forEach(row => {
            const idx = current.findIndex(x => x.id === row.id);
            if (idx > -1) {
              current[idx] = { ...current[idx], ...row };
            } else {
              current.push({
                id: row.id || `id-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                created_at: new Date().toISOString(),
                ...row
              });
            }
          });
          
          setCollection(tableName, current);
          return Promise.resolve({ data: rows, error: null });
        },

        delete: () => {
          return {
            eq: (column: string, value: any) => {
              const current = [...data];
              const filtered = current.filter(row => row[column] !== value);
              setCollection(tableName, filtered);
              return Promise.resolve({ data: null, error: null });
            }
          };
        }
      };
      return api;
    },

    channel: (channelName: string) => {
      const api = {
        on: (event: string, filterConfig: any, callback: Function) => {
          const table = filterConfig.table || "*";
          channels.add({ table, callback });
          return api;
        },
        subscribe: () => {
          return {
            unsubscribe: () => {
              // noop
            }
          };
        }
      };
      return api;
    },

    removeChannel: () => {},

    storage: {
      listBuckets: () => Promise.resolve({ data: [{ name: "menu-images" }], error: null }),
      createBucket: () => Promise.resolve({ data: null, error: null }),
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: null }),
        getPublicUrl: () => ({
          data: { publicUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop&auto=format" }
        })
      })
    }
  };
}

export const supabase = client;
