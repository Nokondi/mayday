import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../utils/password.js";

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await hashPassword("admin123!");
  const admin = await prisma.user.upsert({
    where: { email: "admin@mayday.local" },
    update: {},
    create: {
      email: "admin@mayday.local",
      passwordHash: adminPassword,
      name: "Admin",
      role: "ADMIN",
      bio: "Platform administrator",
      location: "Central",
      skills: ["Community Organization", "Moderation"],
    },
  });

  // Create sample users
  const userPassword = await hashPassword("password123!");

  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      email: "emma@example.com",
      passwordHash: userPassword,
      name: "Emma Goldman",
      bio: "Community organizer and mutual aid enthusiast",
      location: "Hillcrest, Little Rock",
      latitude: 34.7381,
      longitude: -92.2816,
      skills: ["Cooking", "Driving", "Tutoring"],
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      email: "peter@example.com",
      passwordHash: userPassword,
      name: "Peter Kropotkin",
      bio: "Retired teacher, happy to help neighbors",
      location: "The Heights, Little Rock",
      latitude: 34.7465,
      longitude: -92.3412,
      skills: ["Teaching", "Gardening", "Home Repair"],
    },
  });

  // Create sample posts
  await prisma.post.createMany({
    data: [
      {
        type: "REQUEST",
        title: "Need groceries delivered",
        description:
          "I am recovering from surgery and cannot drive. Would appreciate help getting groceries from the local store once a week for the next month.",
        category: "Food",
        location: "Hillcrest, Little Rock",
        latitude: 34.7381,
        longitude: -92.2816,
        urgency: "HIGH",
        authorId: alice.id,
      },
      {
        type: "OFFER",
        title: "Free tutoring for K-12 students",
        description:
          "Retired math teacher offering free tutoring sessions for elementary and middle school students. Available weekday afternoons.",
        category: "Education",
        location: "The Heights, Little Rock",
        latitude: 34.7465,
        longitude: -92.3412,
        urgency: "LOW",
        authorId: bob.id,
      },
      {
        type: "OFFER",
        title: "Can deliver groceries weekly",
        description:
          "I drive past the grocery store every Saturday and am happy to pick up and deliver groceries to anyone in the downtown area.",
        category: "Food",
        location: "Downtown Little Rock",
        latitude: 34.7466,
        longitude: -92.2896,
        urgency: "MEDIUM",
        authorId: bob.id,
      },
      {
        type: "REQUEST",
        title: "Looking for winter clothing for children",
        description:
          "Family of four in need of winter coats and boots for two children (ages 5 and 8). Any donations would be greatly appreciated.",
        category: "Clothing",
        location: "North Little Rock",
        latitude: 34.7695,
        longitude: -92.2671,
        urgency: "CRITICAL",
        authorId: alice.id,
      },
      {
        type: "OFFER",
        title: "Home repair help available",
        description:
          "Handy with tools and happy to help with minor home repairs — leaky faucets, squeaky doors, loose shelves, etc. Free of charge for neighbors in need.",
        category: "Household Items",
        location: "Riverdale, Little Rock",
        latitude: 34.7254,
        longitude: -92.358,
        urgency: "LOW",
        authorId: bob.id,
      },
      {
        type: "REQUEST",
        title: "Need a ride to medical appointments",
        description:
          "I have weekly physical therapy appointments on Tuesdays at 2pm. Looking for someone who could give me a ride (about 3 miles each way).",
        category: "Transportation",
        location: "Midtown Little Rock",
        latitude: 34.7399,
        longitude: -92.3311,
        urgency: "HIGH",
        authorId: alice.id,
      },
    ],
  });

  console.log("Seed data created:");
  console.log(`  Admin: ${admin.email}`);
  console.log(`  Users: ${alice.email}, ${bob.email}`);
  console.log("  6 sample posts created");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
