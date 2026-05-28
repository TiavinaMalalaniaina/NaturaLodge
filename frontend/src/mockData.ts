import { Guest, Room, Booking } from "./types";

export const MOCK_GUESTS: Guest[] = [
  {
    id: "g1",
    name: "Elena Martin",
    email: "elena.martin@outlook.com",
    phone: "+33 6 45 32 11 00",
    address: "Rue de la République, 69002",
    city: "Lyon",
    country: "France",
    status: "VIP Elite",
    lastStay: "Oct 2023",
    memberSince: "2019",
    totalStays: 12,
    lifetimeValue: 42100000,
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCzMmOiS89ayTcEA8DmejAI7dpD8WZ0dQW1KZkV8v_49pbwFQX5NejTsNuadfsID7Ry4X6HsukVgzzxvwpVCGKM0JvuRZGy94CS_cRhJrKSGLm-Zg1tsgQVxIUbOdxDTEFdsLRHQSXCE-027uOu2pzs3J9znz2CDxKUq5oM_Boq6_6Z2ORj-Hy_lwcUo3dXG27__faUzPtqExSrdP5DQB77uW_q7jux5JUV6ugbwZMd-INPAIZR6_PExGWrg8d9i7t2PNBkyoKkAeI",
    preferences: ["Feather-free pillows", "High floors", "Organic Spa", "Window Seat", "Champagne Lover"],
    notes: [
      {
        id: "n1",
        author: "Sarah L.",
        role: "Front Desk",
        date: "Oct 12, 2023",
        content: "Prefers chamomile tea on arrival. Please ensure a fresh sachet is in the room. Mentioned her birthday is coming up in November."
      },
      {
        id: "n2",
        author: "Jean P.",
        role: "Housekeeping",
        date: "Aug 15, 2023",
        content: "Requested extra towels every morning at 9 AM. Very appreciative of the eco-friendly toiletries."
      }
    ]
  },
  {
    id: "g2",
    name: "Julian Thorne",
    email: "j.thorne@global-architects.com",
    phone: "+44 7700 900342",
    address: "Kensington, London",
    city: "London",
    country: "UK",
    status: "Platinum Tier",
    lastStay: "Jun 2023",
    memberSince: "2020",
    totalStays: 12,
    lifetimeValue: 62500000,
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuA7BNdSmA5rY1XKNB_ieiJGvlhZz63eHct0ELh02OBxyT3X1bmQ7pHrQdT3ydmkOg8iDXCJswLJUSyOM7eBQTN9yqng3el77piOGjtdZf-uqVJRsR_1GnP-Fc3lcsJUK76tmaFRkdVcIE3_b3bU8KdYUF-5M2tXCf7iJT2dZ9ex0twLPR5z4Aq_TE-w_zh3r1oJzZiUsqrM6ipCcUxgtuLUcDx6JHo97LBpYX9GUZWYv37rlWlcMO3KNScO6wAOuur7A8_8A_6T1eM",
    preferences: ["Gluten Free", "Black Coffee", "High Floor", "Extra Pillows"],
    notes: [
      {
        id: "n3",
        author: "Marc D.",
        role: "Concierge",
        date: "Aug 12, 2023",
        content: "Guest celebrates 20th anniversary during the October stay. Prepared a welcome bottle of vintage Krug."
      }
    ]
  }
];

export const MOCK_FEATURES = [
  { id: 'wifi', label: 'High-speed Wi-Fi', iconName: 'Wifi' },
  { id: 'coffee', label: 'Organic Coffee Bar', iconName: 'Coffee' },
  { id: 'ac', label: 'Eco-Air Control', iconName: 'Wind' },
  { id: 'tv', label: 'Smart TV 4K', iconName: 'Tv' },
  { id: 'entry', label: 'Contactless Entry', iconName: 'ShieldCheck' },
  { id: 'guide', label: 'Curated Local Guide', iconName: 'Map' },
];

export const MOCK_ROOMS: Room[] = [
  {
    id: "r1",
    number: "101",
    type: "Natura Signature Suite",
    category: "Suite",
    area: 55,
    bedType: "King Bed",
    capacity: "2 Guests",
    rate: 1500000,
    status: "occupied",
    view: "Garden View",
    images: ["https://lh3.googleusercontent.com/aida-public/AB6AXuCJGtxKBShtiuuoljR-Rxo0FTOvCLikW2gAAXAkUXdAoiGoJ_a2JVE5284uz7gyQRUnKvokzQpTZeH08ZCx8cHriSTTObOLsOW3zqs4zERjRPxwWzXKyvy5A8VW-XiDJYRkN5LBC5gNnRdM5mZfKGvwoqPCsuSZySJDJxc340jEOiTWyvTN2i32KqO3VPsCJY_HNHITuT0QzvyKdUuuCZXjntarrMdnYEnNQLckw49R-kdkYhajGK2laTOMCFrEpKYd0EKacjSg8G0"],
    description: "55sqm sanctuary with organic cotton bedding and an artisanal stone-clad bathroom.",
    features: ['wifi', 'coffee', 'ac', 'tv', 'entry']
  },
  {
    id: "r2",
    number: "402",
    type: "Deluxe Suite",
    category: "Suite",
    area: 74,
    bedType: "King Size",
    capacity: "2 Adults, 1 Child",
    rate: 2000000,
    status: "available",
    view: "Ocean View",
    images: ["https://lh3.googleusercontent.com/aida-public/AB6AXuCWAt_LPZZHf4aLW-dPtD2sd6rWhnu8yT0rVYPC7kjJJvH6g5EHTx7EmMjB-qlRIk95uUcE47zTi-g7FDtMH_eHA22-QOjOPv2Vzs2LbSpFW8wZyH2lK4vty-OdoUZ3Dlk_hqOiDWwUp8U6rJoQJiL1LQN4ik31Z4Hy5_5pzaolpis8y8CeXmbifzPxfymJ7qILjfGxVU2HfWsl2ApA6VRzVXssdSRhrDV0uUdu7olGPlSFiSjdh-skDhC0R2SV77ci83b2vLS1VSs"],
    description: "The Natura Suite blends contemporary elegance with tactile warmth. Featuring floor-to-ceiling windows overlooking the botanical atrium.",
    features: ['wifi', 'coffee', 'ac', 'tv', 'entry', 'guide']
  },
  {
    id: "r3",
    number: "105",
    type: "Garden Villa",
    category: "Villa",
    area: 120,
    bedType: "King Bed",
    capacity: "4 Guests",
    rate: 5500000,
    status: "occupied",
    view: "Private Pool • Garden",
    images: ["https://lh3.googleusercontent.com/aida-public/AB6AXuDhTmCBHkWSfCH0GG6vmxctpyflDX-95kFG9FLnurEGADEsA-dj7IUcyhcKAGRkEDv-kSrBLudWYw3UcRqKuMO594_MKyb30D5ehxooXitfdGnZ7-LSyycuvetrQkp0l6qVNZWKR2-WFTf3eynzoCjO_IELZWoDbjcdpRnaGEtnxnqMTwP6uOopZ9Td0y5gQnEDOKThBicFbY5MqOyDbggs3bHneJ4i40GvL0eLvEWR6FkTiesbpzJffBbuYGsD3P3Vp6AUzLcJc7Y"],
    description: "A sprawling villa with a private garden and pool, offering ultimate privacy.",
    features: ['wifi', 'coffee', 'ac', 'tv', 'entry', 'guide']
  },
  {
    id: "r4",
    number: "208",
    type: "Standard Room",
    category: "Superior",
    area: 32,
    bedType: "Single Bed",
    capacity: "1 Guest",
    rate: 600000,
    status: "maintenance",
    view: "Courtyard",
    images: [],
    description: "A cozy standard room perfect for short stays.",
    features: ['wifi', 'tv']
  }
];

export const MOCK_BOOKINGS: Booking[] = [
  {
    id: "b1",
    guestId: "g1",
    guestName: "Elena Martin",
    roomId: "r1",
    roomNumber: "101",
    roomType: "Suite",
    arrival: "2023-10-24",
    departure: "2023-10-28",
    status: "confirmed",
    totalAmount: 6000000
  },
  {
    id: "b2",
    guestId: "g2",
    guestName: "Julian Thorne",
    roomId: "r2",
    roomNumber: "402",
    roomType: "Deluxe Suite",
    arrival: "2023-10-27",
    departure: "2023-10-31",
    status: "awaiting",
    totalAmount: 8500000
  },
  {
    id: "b3",
    guestId: "g3",
    guestName: "Sarah Harrison",
    roomId: "r3",
    roomNumber: "105",
    roomType: "Garden Villa",
    arrival: "2023-10-23",
    departure: "2023-10-30",
    status: "checked-in",
    totalAmount: 38500000
  },
  {
    id: "b4",
    guestId: "g4",
    guestName: "Marcus Sterling",
    roomId: "r4",
    roomNumber: "601",
    roomType: "Penthouse",
    arrival: "2023-10-25",
    departure: "2023-10-27",
    status: "confirmed",
    totalAmount: 22000000
  },
  {
    id: "b5",
    guestId: "g5",
    guestName: "Sophie Bennett",
    roomId: "r5",
    roomNumber: "205",
    roomType: "Superior",
    arrival: "2023-10-26",
    departure: "2023-10-29",
    status: "confirmed",
    totalAmount: 2400000
  }
];
