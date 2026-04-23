import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../utils/password.js";

const prisma = new PrismaClient();

// Next occurrence of a weekday at a given time (0=Sun..6=Sat). Always in the future.
function nextWeekdayAt(day: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  const diff = (day - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
  return d;
}

// Little Rock neighborhood coordinates
const neighborhoods = {
  meadowbrook: { location: "Meadowbrook, Little Rock", lat: 34.7211, lng: -92.2766 },
  quapawQuarter: { location: "Quapaw Quarter, Little Rock", lat: 34.7344, lng: -92.273 },
  baseline: { location: "Baseline, Little Rock", lat: 34.6681, lng: -92.3179 },
  capitolView: { location: "Capitol View, Little Rock", lat: 34.725, lng: -92.25 },
  midtown: { location: "Midtown, Little Rock", lat: 34.7399, lng: -92.3311 },
  downtown: { location: "Downtown, Little Rock", lat: 34.7466, lng: -92.2896 },
  riverdale: { location: "Riverdale, Little Rock", lat: 34.7254, lng: -92.358 },
};

async function main() {
  // ---- Users ----

  const adminPassword = await hashPassword("admin123!");
  const admin = await prisma.user.upsert({
    where: { email: "admin@mayday.local" },
    update: { emailVerified: true },
    create: {
      email: "admin@mayday.local",
      passwordHash: adminPassword,
      name: "Admin",
      role: "ADMIN",
      bio: "Platform administrator",
      location: "Little Rock, AR",
      skills: ["Community Organization", "Moderation"],
      emailVerified: true,
    },
  });

  const userPassword = await hashPassword("password123!");

  const emma = await prisma.user.upsert({
    where: { email: "emma@example.com" },
    update: { emailVerified: true },
    create: {
      email: "emma@example.com",
      passwordHash: userPassword,
      name: "Emma Goldman",
      bio: "Revolutionary, activist, and writer",
      location: neighborhoods.midtown.location,
      latitude: neighborhoods.midtown.lat,
      longitude: neighborhoods.midtown.lng,
      skills: ["Writing", "Sewing", "Nursing"],
      emailVerified: true,
    },
  });

  const peter = await prisma.user.upsert({
    where: { email: "peter@example.com" },
    update: { emailVerified: true },
    create: {
      email: "peter@example.com",
      passwordHash: userPassword,
      name: "Peter Kropotkin",
      bio: "Retired geographer and mutual aid enthusiast",
      location: neighborhoods.meadowbrook.location,
      latitude: neighborhoods.meadowbrook.lat,
      longitude: neighborhoods.meadowbrook.lng,
      skills: ["Teaching", "Writing", "Baking"],
      emailVerified: true,
    },
  });

  const david = await prisma.user.upsert({
    where: { email: "david@example.com" },
    update: { emailVerified: true },
    create: {
      email: "david@example.com",
      passwordHash: userPassword,
      name: "David Graeber",
      bio: "Anthropologist, author, and organizer. Interested in mutual aid, direct action, and the history of debt.",
      location: neighborhoods.downtown.location,
      latitude: neighborhoods.downtown.lat,
      longitude: neighborhoods.downtown.lng,
      skills: ["Research", "Writing", "Organizing", "Teaching"],
      emailVerified: true,
    },
  });

  const ursula = await prisma.user.upsert({
    where: { email: "ursula@example.com" },
    update: { emailVerified: true },
    create: {
      email: "ursula@example.com",
      passwordHash: userPassword,
      name: "Ursula Le Guin",
      bio: "Writer and storyteller exploring how communities care for one another.",
      location: neighborhoods.riverdale.location,
      latitude: neighborhoods.riverdale.lat,
      longitude: neighborhoods.riverdale.lng,
      skills: ["Writing", "Gardening", "Storytelling", "Cooking"],
      emailVerified: true,
    },
  });

  // ---- Organizations ----

  const littleRockMutualAid = await prisma.organization.create({
    data: {
      name: "Little Rock Mutual Aid",
      description:
        "A city-wide network coordinating mutual aid efforts across Little Rock. We connect people who need help with people who can give it.",
      location: neighborhoods.downtown.location,
      latitude: neighborhoods.downtown.lat,
      longitude: neighborhoods.downtown.lng,
      members: {
        create: [
          { userId: emma.id, role: "OWNER" },
          { userId: peter.id, role: "ADMIN" },
          { userId: david.id, role: "MEMBER" },
          { userId: ursula.id, role: "MEMBER" },
        ],
      },
    },
  });

  const foodNotBombs = await prisma.organization.create({
    data: {
      name: "Food Not Bombs LR",
      description:
        "We recover food that would otherwise be thrown away and share free meals with anyone who is hungry. Solidarity, not charity.",
      location: neighborhoods.quapawQuarter.location,
      latitude: neighborhoods.quapawQuarter.lat,
      longitude: neighborhoods.quapawQuarter.lng,
      members: {
        create: [
          { userId: david.id, role: "OWNER" },
          { userId: emma.id, role: "MEMBER" },
          { userId: peter.id, role: "MEMBER" },
        ],
      },
    },
  });

  const freeClinic = await prisma.organization.create({
    data: {
      name: "Baseline Free Clinic",
      description:
        "Volunteer-run clinic offering free basic medical care, first aid supplies, and health education to uninsured community members.",
      location: neighborhoods.baseline.location,
      latitude: neighborhoods.baseline.lat,
      longitude: neighborhoods.baseline.lng,
      members: {
        create: [
          { userId: ursula.id, role: "OWNER" },
          { userId: emma.id, role: "ADMIN" },
        ],
      },
    },
  });

  const capitolViewToolLibrary = await prisma.organization.create({
    data: {
      name: "Capitol View Tool Library",
      description:
        "A shared tool lending library for Capitol View residents. Borrow drills, saws, ladders, and more \u2014 no need to buy what you only use once.",
      location: neighborhoods.capitolView.location,
      latitude: neighborhoods.capitolView.lat,
      longitude: neighborhoods.capitolView.lng,
      members: {
        create: [
          { userId: peter.id, role: "OWNER" },
          { userId: david.id, role: "ADMIN" },
          { userId: emma.id, role: "MEMBER" },
        ],
      },
    },
  });

  const midtownChildcareCoop = await prisma.organization.create({
    data: {
      name: "Midtown Childcare Co-op",
      description:
        "A cooperative of Midtown families sharing childcare duties. Members take turns watching each other\u2019s kids so everyone gets a break.",
      location: neighborhoods.midtown.location,
      latitude: neighborhoods.midtown.lat,
      longitude: neighborhoods.midtown.lng,
      members: {
        create: [
          { userId: emma.id, role: "OWNER" },
          { userId: ursula.id, role: "MEMBER" },
        ],
      },
    },
  });

  const riverdaleRepairCafe = await prisma.organization.create({
    data: {
      name: "Riverdale Repair Caf\u00e9",
      description:
        "Bring your broken appliances, clothes, bikes, and electronics. Volunteer fixers will help you repair them for free. Held the first Sunday of every month.",
      location: neighborhoods.riverdale.location,
      latitude: neighborhoods.riverdale.lat,
      longitude: neighborhoods.riverdale.lng,
      members: {
        create: [
          { userId: ursula.id, role: "OWNER" },
          { userId: peter.id, role: "ADMIN" },
          { userId: david.id, role: "MEMBER" },
        ],
      },
    },
  });

  const meadowbrookPantry = await prisma.organization.create({
    data: {
      name: "Meadowbrook Community Pantry",
      description:
        "A neighborhood-run free pantry stocked by donations from local residents and businesses. Take what you need, leave what you can.",
      location: neighborhoods.meadowbrook.location,
      latitude: neighborhoods.meadowbrook.lat,
      longitude: neighborhoods.meadowbrook.lng,
      members: {
        create: [
          { userId: peter.id, role: "OWNER" },
          { userId: emma.id, role: "MEMBER" },
          { userId: ursula.id, role: "MEMBER" },
        ],
      },
    },
  });

  // ---- Communities ----

  const meadowbrookNeighbors = await prisma.community.create({
    data: {
      name: "Meadowbrook Neighbors",
      description:
        "A community for residents of the Meadowbrook neighborhood to share resources, post requests, and look out for each other.",
      location: neighborhoods.meadowbrook.location,
      latitude: neighborhoods.meadowbrook.lat,
      longitude: neighborhoods.meadowbrook.lng,
      members: {
        create: [
          { userId: peter.id, role: "OWNER" },
          { userId: emma.id, role: "MEMBER" },
          { userId: ursula.id, role: "MEMBER" },
        ],
      },
    },
  });

  const quapawQuarterCommunity = await prisma.community.create({
    data: {
      name: "Quapaw Quarter Community",
      description:
        "Connecting residents of the historic Quapaw Quarter. Share what you have, ask for what you need, and keep our neighborhood strong.",
      location: neighborhoods.quapawQuarter.location,
      latitude: neighborhoods.quapawQuarter.lat,
      longitude: neighborhoods.quapawQuarter.lng,
      members: {
        create: [
          { userId: david.id, role: "OWNER" },
          { userId: emma.id, role: "ADMIN" },
          { userId: peter.id, role: "MEMBER" },
        ],
      },
    },
  });

  const baselineCommunity = await prisma.community.create({
    data: {
      name: "Baseline Community",
      description:
        "Neighbors helping neighbors in the Baseline area. Whether you need a hand or can lend one, this is the place.",
      location: neighborhoods.baseline.location,
      latitude: neighborhoods.baseline.lat,
      longitude: neighborhoods.baseline.lng,
      members: {
        create: [
          { userId: ursula.id, role: "OWNER" },
          { userId: emma.id, role: "MEMBER" },
        ],
      },
    },
  });

  const capitolViewNeighbors = await prisma.community.create({
    data: {
      name: "Capitol View Neighbors",
      description:
        "Capitol View\u2019s neighborhood hub for mutual aid, resource sharing, and community updates.",
      location: neighborhoods.capitolView.location,
      latitude: neighborhoods.capitolView.lat,
      longitude: neighborhoods.capitolView.lng,
      members: {
        create: [
          { userId: peter.id, role: "OWNER" },
          { userId: david.id, role: "ADMIN" },
          { userId: ursula.id, role: "MEMBER" },
        ],
      },
    },
  });

  const midtownNeighbors = await prisma.community.create({
    data: {
      name: "Midtown Neighbors",
      description:
        "A community for Midtown residents to coordinate mutual aid, share resources, and support each other.",
      location: neighborhoods.midtown.location,
      latitude: neighborhoods.midtown.lat,
      longitude: neighborhoods.midtown.lng,
      members: {
        create: [
          { userId: emma.id, role: "OWNER" },
          { userId: david.id, role: "MEMBER" },
          { userId: ursula.id, role: "MEMBER" },
        ],
      },
    },
  });

  const downtownCommunity = await prisma.community.create({
    data: {
      name: "Downtown Little Rock",
      description:
        "Downtown residents and workers connecting to share resources, offer help, and build community in the heart of the city.",
      location: neighborhoods.downtown.location,
      latitude: neighborhoods.downtown.lat,
      longitude: neighborhoods.downtown.lng,
      members: {
        create: [
          { userId: david.id, role: "OWNER" },
          { userId: peter.id, role: "MEMBER" },
          { userId: emma.id, role: "MEMBER" },
        ],
      },
    },
  });

  const riverdaleCommunity = await prisma.community.create({
    data: {
      name: "Riverdale Community",
      description:
        "Riverdale\u2019s neighborhood network for sharing resources, gardening tips, and helping one another.",
      location: neighborhoods.riverdale.location,
      latitude: neighborhoods.riverdale.lat,
      longitude: neighborhoods.riverdale.lng,
      members: {
        create: [
          { userId: ursula.id, role: "OWNER" },
          { userId: peter.id, role: "ADMIN" },
          { userId: david.id, role: "MEMBER" },
        ],
      },
    },
  });

  // ---- Public Posts (spread across all 7 neighborhoods) ----

  await prisma.post.createMany({
    data: [
      // Meadowbrook
      {
        type: "REQUEST",
        title: "Need groceries delivered",
        description:
          "I am recovering from surgery and cannot drive. Would appreciate help getting groceries from the local store once a week for the next month.",
        category: "Food",
        location: neighborhoods.meadowbrook.location,
        latitude: neighborhoods.meadowbrook.lat,
        longitude: neighborhoods.meadowbrook.lng,
        urgency: "HIGH",
        authorId: peter.id,
      },
      {
        type: "OFFER",
        title: "Can deliver groceries weekly",
        description:
          "I drive past the grocery store every Saturday and am happy to pick up and deliver groceries to anyone in the Meadowbrook area.",
        category: "Food",
        location: neighborhoods.meadowbrook.location,
        latitude: neighborhoods.meadowbrook.lat,
        longitude: neighborhoods.meadowbrook.lng,
        urgency: "MEDIUM",
        authorId: david.id,
      },
      // Quapaw Quarter
      {
        type: "OFFER",
        title: "Free tutoring for K-12 students",
        description:
          "Retired math teacher offering free tutoring sessions for elementary and middle school students. Available weekday afternoons.",
        category: "Education",
        location: neighborhoods.quapawQuarter.location,
        latitude: neighborhoods.quapawQuarter.lat,
        longitude: neighborhoods.quapawQuarter.lng,
        urgency: "LOW",
        authorId: emma.id,
      },
      {
        type: "REQUEST",
        title: "Looking for winter clothing for children",
        description:
          "Family of four in need of winter coats and boots for two children (ages 5 and 8). Any donations would be greatly appreciated.",
        category: "Clothing",
        location: neighborhoods.quapawQuarter.location,
        latitude: neighborhoods.quapawQuarter.lat,
        longitude: neighborhoods.quapawQuarter.lng,
        urgency: "CRITICAL",
        authorId: ursula.id,
      },
      // Baseline
      {
        type: "REQUEST",
        title: "Need a ride to medical appointments",
        description:
          "I have weekly physical therapy appointments on Tuesdays at 2pm in Baseline. Looking for someone who could give me a ride (about 3 miles each way).",
        category: "Transportation",
        location: neighborhoods.baseline.location,
        latitude: neighborhoods.baseline.lat,
        longitude: neighborhoods.baseline.lng,
        urgency: "HIGH",
        authorId: peter.id,
      },
      {
        type: "OFFER",
        title: "Free blood pressure checks",
        description:
          "I\u2019m a retired nurse offering free blood pressure screenings on my porch every Wednesday afternoon. No appointment needed, just stop by.",
        category: "Healthcare",
        location: neighborhoods.baseline.location,
        latitude: neighborhoods.baseline.lat,
        longitude: neighborhoods.baseline.lng,
        urgency: "LOW",
        authorId: emma.id,
        startAt: nextWeekdayAt(3, 14, 0),
        endAt: nextWeekdayAt(3, 17, 0),
        recurrenceFreq: "WEEK",
        recurrenceInterval: 1,
      },
      // Capitol View
      {
        type: "OFFER",
        title: "Home repair help available",
        description:
          "Handy with tools and happy to help with minor home repairs \u2014 leaky faucets, squeaky doors, loose shelves, etc. Free of charge for neighbors in need.",
        category: "Household Items",
        location: neighborhoods.capitolView.location,
        latitude: neighborhoods.capitolView.lat,
        longitude: neighborhoods.capitolView.lng,
        urgency: "LOW",
        authorId: emma.id,
      },
      {
        type: "REQUEST",
        title: "Need help assembling a wheelchair ramp",
        description:
          "My mother is coming home from the hospital and we need to build a small wheelchair ramp for her front porch. Materials are purchased, just need a couple extra hands.",
        category: "Housing",
        location: neighborhoods.capitolView.location,
        latitude: neighborhoods.capitolView.lat,
        longitude: neighborhoods.capitolView.lng,
        urgency: "HIGH",
        authorId: peter.id,
      },
      // Midtown
      {
        type: "OFFER",
        title: "Free resume and job application help",
        description:
          "I\u2019m a former HR manager and I\u2019d love to help anyone who needs a hand with their resume, cover letters, or job applications. Meet me at the Midtown library.",
        category: "Employment",
        location: neighborhoods.midtown.location,
        latitude: neighborhoods.midtown.lat,
        longitude: neighborhoods.midtown.lng,
        urgency: "LOW",
        authorId: david.id,
      },
      {
        type: "REQUEST",
        title: "Seeking after-school childcare help",
        description:
          "Single parent looking for someone who can pick up my 7-year-old from school at 3pm two days a week. Can trade help on weekends.",
        category: "Childcare",
        location: neighborhoods.midtown.location,
        latitude: neighborhoods.midtown.lat,
        longitude: neighborhoods.midtown.lng,
        urgency: "MEDIUM",
        authorId: emma.id,
      },
      // Downtown
      {
        type: "REQUEST",
        title: "Need help understanding lease agreement",
        description:
          "My landlord sent a new lease with some clauses I don\u2019t understand. Looking for someone with legal knowledge who can help me review it before I sign.",
        category: "Legal Aid",
        location: neighborhoods.downtown.location,
        latitude: neighborhoods.downtown.lat,
        longitude: neighborhoods.downtown.lng,
        urgency: "MEDIUM",
        authorId: david.id,
      },
      {
        type: "OFFER",
        title: "Emotional support and active listening",
        description:
          "Sometimes you just need someone to talk to. I\u2019m a trained peer counselor and I\u2019m offering free one-on-one chats downtown. No judgment, just support.",
        category: "Emotional Support",
        location: neighborhoods.downtown.location,
        latitude: neighborhoods.downtown.lat,
        longitude: neighborhoods.downtown.lng,
        urgency: "LOW",
        authorId: ursula.id,
      },
      // Riverdale
      {
        type: "OFFER",
        title: "Free bike tune-ups this weekend",
        description:
          "I have tools and parts to do basic bike maintenance \u2014 flat tires, brake adjustments, chain lubing. Bring your bike to my garage on Saturday morning.",
        category: "Transportation",
        location: neighborhoods.riverdale.location,
        latitude: neighborhoods.riverdale.lat,
        longitude: neighborhoods.riverdale.lng,
        urgency: "LOW",
        authorId: ursula.id,
        startAt: nextWeekdayAt(6, 9, 0),
        endAt: nextWeekdayAt(6, 12, 0),
      },
      {
        type: "REQUEST",
        title: "Looking for a working washing machine",
        description:
          "Ours just died and we can\u2019t afford a replacement right now. If anyone has a working washer they\u2019re getting rid of, we\u2019d be incredibly grateful. Can pick up.",
        category: "Household Items",
        location: neighborhoods.riverdale.location,
        latitude: neighborhoods.riverdale.lat,
        longitude: neighborhoods.riverdale.lng,
        urgency: "HIGH",
        authorId: peter.id,
      },
    ],
  });

  // ---- Organization Posts ----

  await prisma.post.createMany({
    data: [
      // Food Not Bombs (Quapaw Quarter)
      {
        type: "OFFER",
        title: "Free hot meals every Saturday",
        description:
          "Food Not Bombs is sharing free hot meals in Quapaw Quarter Park every Saturday from 12\u20132pm. All are welcome, no questions asked. Vegan and gluten-free options available.",
        category: "Food",
        location: neighborhoods.quapawQuarter.location,
        latitude: neighborhoods.quapawQuarter.lat,
        longitude: neighborhoods.quapawQuarter.lng,
        urgency: "LOW",
        authorId: david.id,
        organizationId: foodNotBombs.id,
        startAt: nextWeekdayAt(6, 12, 0),
        endAt: nextWeekdayAt(6, 14, 0),
        recurrenceFreq: "WEEK",
        recurrenceInterval: 1,
      },
      {
        type: "REQUEST",
        title: "Volunteers needed for meal prep",
        description:
          "We need 3\u20134 volunteers each Friday evening to help prepare Saturday\u2019s meals. No experience needed \u2014 just show up at 6pm and we\u2019ll put you to work!",
        category: "Food",
        location: neighborhoods.quapawQuarter.location,
        latitude: neighborhoods.quapawQuarter.lat,
        longitude: neighborhoods.quapawQuarter.lng,
        urgency: "MEDIUM",
        authorId: david.id,
        organizationId: foodNotBombs.id,
        startAt: nextWeekdayAt(5, 18, 0),
        endAt: nextWeekdayAt(5, 21, 0),
        recurrenceFreq: "WEEK",
        recurrenceInterval: 1,
      },
      // Baseline Free Clinic
      {
        type: "OFFER",
        title: "Free first aid kits for households",
        description:
          "The Baseline Free Clinic has assembled 50 basic first aid kits to give away. Each includes bandages, antiseptic, pain relievers, and a guide. Stop by the clinic any weekday.",
        category: "Healthcare",
        location: neighborhoods.baseline.location,
        latitude: neighborhoods.baseline.lat,
        longitude: neighborhoods.baseline.lng,
        urgency: "LOW",
        authorId: ursula.id,
        organizationId: freeClinic.id,
      },
      {
        type: "REQUEST",
        title: "Seeking volunteer nurses and EMTs",
        description:
          "Our free clinic is looking for licensed nurses or EMTs who can volunteer a few hours per month. We provide care to uninsured neighbors and every bit of help matters.",
        category: "Healthcare",
        location: neighborhoods.baseline.location,
        latitude: neighborhoods.baseline.lat,
        longitude: neighborhoods.baseline.lng,
        urgency: "HIGH",
        authorId: emma.id,
        organizationId: freeClinic.id,
      },
      // Little Rock Mutual Aid (Downtown)
      {
        type: "OFFER",
        title: "Emergency supply distribution this weekend",
        description:
          "Little Rock Mutual Aid is distributing hygiene kits, canned food, and blankets at the downtown community center this Saturday 10am\u20131pm. Spread the word!",
        category: "Household Items",
        location: neighborhoods.downtown.location,
        latitude: neighborhoods.downtown.lat,
        longitude: neighborhoods.downtown.lng,
        urgency: "MEDIUM",
        authorId: emma.id,
        organizationId: littleRockMutualAid.id,
        startAt: nextWeekdayAt(6, 10, 0),
        endAt: nextWeekdayAt(6, 13, 0),
      },
      {
        type: "REQUEST",
        title: "Donation drive: canned goods and hygiene products",
        description:
          "We\u2019re restocking our mutual aid pantry for summer. Drop off canned food, soap, toothbrushes, and diapers at the downtown hub any weekday 9\u20135.",
        category: "Food",
        location: neighborhoods.downtown.location,
        latitude: neighborhoods.downtown.lat,
        longitude: neighborhoods.downtown.lng,
        urgency: "MEDIUM",
        authorId: peter.id,
        organizationId: littleRockMutualAid.id,
      },
      // Capitol View Tool Library
      {
        type: "OFFER",
        title: "Borrow power tools for free",
        description:
          "The Capitol View Tool Library is open! Borrow drills, circular saws, ladders, and more with a library card. Open Saturdays 9am\u201312pm.",
        category: "Household Items",
        location: neighborhoods.capitolView.location,
        latitude: neighborhoods.capitolView.lat,
        longitude: neighborhoods.capitolView.lng,
        urgency: "LOW",
        authorId: peter.id,
        organizationId: capitolViewToolLibrary.id,
        startAt: nextWeekdayAt(6, 9, 0),
        endAt: nextWeekdayAt(6, 12, 0),
        recurrenceFreq: "WEEK",
        recurrenceInterval: 1,
      },
      {
        type: "REQUEST",
        title: "Tool donations needed",
        description:
          "Our lending library is looking for donated hand tools, garden tools, and small power tools. Everything gets shared with the neighborhood for free.",
        category: "Household Items",
        location: neighborhoods.capitolView.location,
        latitude: neighborhoods.capitolView.lat,
        longitude: neighborhoods.capitolView.lng,
        urgency: "LOW",
        authorId: david.id,
        organizationId: capitolViewToolLibrary.id,
      },
      // Midtown Childcare Co-op
      {
        type: "OFFER",
        title: "Childcare swap: Tuesday and Thursday afternoons",
        description:
          "The Midtown Childcare Co-op has open spots for Tuesday and Thursday afternoon childcare swaps. Families take turns watching 3\u20134 kids ages 3\u20138. Join us!",
        category: "Childcare",
        location: neighborhoods.midtown.location,
        latitude: neighborhoods.midtown.lat,
        longitude: neighborhoods.midtown.lng,
        urgency: "LOW",
        authorId: emma.id,
        organizationId: midtownChildcareCoop.id,
      },
      // Riverdale Repair Caf\u00e9
      {
        type: "OFFER",
        title: "Repair Caf\u00e9 this Sunday",
        description:
          "Bring your broken small appliances, torn clothes, wobbly furniture, or flat bike tires to the Riverdale Community Center this Sunday 1\u20134pm. Our volunteer fixers will help you repair them for free!",
        category: "Household Items",
        location: neighborhoods.riverdale.location,
        latitude: neighborhoods.riverdale.lat,
        longitude: neighborhoods.riverdale.lng,
        urgency: "LOW",
        authorId: ursula.id,
        organizationId: riverdaleRepairCafe.id,
        startAt: nextWeekdayAt(0, 13, 0),
        endAt: nextWeekdayAt(0, 16, 0),
      },
      {
        type: "REQUEST",
        title: "Volunteer fixers wanted",
        description:
          "The Riverdale Repair Caf\u00e9 is looking for people who are handy with sewing machines, soldering irons, or bike wrenches. Volunteer once a month and help keep things out of landfills.",
        category: "Other",
        location: neighborhoods.riverdale.location,
        latitude: neighborhoods.riverdale.lat,
        longitude: neighborhoods.riverdale.lng,
        urgency: "LOW",
        authorId: peter.id,
        organizationId: riverdaleRepairCafe.id,
      },
      // Meadowbrook Community Pantry
      {
        type: "OFFER",
        title: "Free pantry restocked with fresh produce",
        description:
          "The Meadowbrook Community Pantry just got a fresh delivery of vegetables from local farms. Come by and take what your family needs \u2014 no sign-up required.",
        category: "Food",
        location: neighborhoods.meadowbrook.location,
        latitude: neighborhoods.meadowbrook.lat,
        longitude: neighborhoods.meadowbrook.lng,
        urgency: "LOW",
        authorId: peter.id,
        organizationId: meadowbrookPantry.id,
      },
      {
        type: "REQUEST",
        title: "Pantry volunteers for Saturday mornings",
        description:
          "We need a couple of people to help sort donations and restock the pantry shelves on Saturday mornings from 8\u201310am. Great for teens needing service hours!",
        category: "Food",
        location: neighborhoods.meadowbrook.location,
        latitude: neighborhoods.meadowbrook.lat,
        longitude: neighborhoods.meadowbrook.lng,
        urgency: "LOW",
        authorId: emma.id,
        organizationId: meadowbrookPantry.id,
        startAt: nextWeekdayAt(6, 8, 0),
        endAt: nextWeekdayAt(6, 10, 0),
        recurrenceFreq: "WEEK",
        recurrenceInterval: 1,
      },
    ],
  });

  // ---- Community Posts ----

  await prisma.post.createMany({
    data: [
      // Meadowbrook Neighbors
      {
        type: "REQUEST",
        title: "Anyone have a spare lawnmower?",
        description:
          "Mine broke down and the grass is getting out of hand. Happy to borrow one for the weekend or split the cost of a repair.",
        category: "Household Items",
        location: neighborhoods.meadowbrook.location,
        latitude: neighborhoods.meadowbrook.lat,
        longitude: neighborhoods.meadowbrook.lng,
        urgency: "LOW",
        authorId: emma.id,
        communityId: meadowbrookNeighbors.id,
      },
      {
        type: "OFFER",
        title: "Homemade soup for anyone feeling under the weather",
        description:
          "I made a big batch of chicken soup today. If you or someone you know is sick or just having a rough time, I\u2019m happy to drop off a jar. Message me!",
        category: "Food",
        location: neighborhoods.meadowbrook.location,
        latitude: neighborhoods.meadowbrook.lat,
        longitude: neighborhoods.meadowbrook.lng,
        urgency: "LOW",
        authorId: ursula.id,
        communityId: meadowbrookNeighbors.id,
      },
      // Quapaw Quarter Community
      {
        type: "REQUEST",
        title: "Seeking recommendations for affordable plumber",
        description:
          "Got a slow drain in the kitchen that\u2019s getting worse. Anyone in QQ know a reliable, affordable plumber? Or if someone is handy with drains, I\u2019d appreciate the help!",
        category: "Housing",
        location: neighborhoods.quapawQuarter.location,
        latitude: neighborhoods.quapawQuarter.lat,
        longitude: neighborhoods.quapawQuarter.lng,
        urgency: "MEDIUM",
        authorId: peter.id,
        communityId: quapawQuarterCommunity.id,
      },
      {
        type: "OFFER",
        title: "Free piano lessons for beginners",
        description:
          "I have a piano and 20 years of playing. Happy to teach basics to any neighbor who\u2019s interested \u2014 kids or adults. One hour a week, no charge.",
        category: "Education",
        location: neighborhoods.quapawQuarter.location,
        latitude: neighborhoods.quapawQuarter.lat,
        longitude: neighborhoods.quapawQuarter.lng,
        urgency: "LOW",
        authorId: david.id,
        communityId: quapawQuarterCommunity.id,
      },
      // Baseline Community
      {
        type: "REQUEST",
        title: "Looking for someone to walk my dog while I\u2019m at work",
        description:
          "I just started a new job with long hours and my dog needs a midday walk. If anyone in Baseline is available around noon on weekdays, please reach out!",
        category: "Other",
        location: neighborhoods.baseline.location,
        latitude: neighborhoods.baseline.lat,
        longitude: neighborhoods.baseline.lng,
        urgency: "MEDIUM",
        authorId: ursula.id,
        communityId: baselineCommunity.id,
      },
      {
        type: "OFFER",
        title: "Sharing my streaming subscriptions",
        description:
          "I have Netflix and a library card with free Kanopy access. Happy to share login info with a neighbor or two. Message me and we can work it out.",
        category: "Other",
        location: neighborhoods.baseline.location,
        latitude: neighborhoods.baseline.lat,
        longitude: neighborhoods.baseline.lng,
        urgency: "LOW",
        authorId: emma.id,
        communityId: baselineCommunity.id,
      },
      // Capitol View Neighbors
      {
        type: "REQUEST",
        title: "Need help moving a couch this Saturday",
        description:
          "I\u2019m moving a couch from my living room to a friend\u2019s place a few blocks away. Could use one more person to help carry it. Should take 30 minutes tops.",
        category: "Household Items",
        location: neighborhoods.capitolView.location,
        latitude: neighborhoods.capitolView.lat,
        longitude: neighborhoods.capitolView.lng,
        urgency: "MEDIUM",
        authorId: david.id,
        communityId: capitolViewNeighbors.id,
        startAt: nextWeekdayAt(6, 10, 0),
        endAt: nextWeekdayAt(6, 11, 0),
      },
      {
        type: "OFFER",
        title: "Free bread from yesterday\u2019s bake",
        description:
          "Baked way too much sourdough again. I have 4 extra loaves \u2014 come grab one from my porch on Elm Street, first come first served.",
        category: "Food",
        location: neighborhoods.capitolView.location,
        latitude: neighborhoods.capitolView.lat,
        longitude: neighborhoods.capitolView.lng,
        urgency: "LOW",
        authorId: peter.id,
        communityId: capitolViewNeighbors.id,
      },
      // Midtown Neighbors
      {
        type: "OFFER",
        title: "Offering rides to the grocery store on Wednesdays",
        description:
          "I do my grocery shopping every Wednesday morning. If any Midtown neighbor needs a ride to the store, I\u2019m happy to swing by and pick you up.",
        category: "Transportation",
        location: neighborhoods.midtown.location,
        latitude: neighborhoods.midtown.lat,
        longitude: neighborhoods.midtown.lng,
        urgency: "LOW",
        authorId: emma.id,
        communityId: midtownNeighbors.id,
      },
      {
        type: "REQUEST",
        title: "Does anyone have a pressure cooker I can borrow?",
        description:
          "I want to try canning some tomatoes from my garden but I don\u2019t have a pressure cooker. Would love to borrow one for a day or two.",
        category: "Household Items",
        location: neighborhoods.midtown.location,
        latitude: neighborhoods.midtown.lat,
        longitude: neighborhoods.midtown.lng,
        urgency: "LOW",
        authorId: david.id,
        communityId: midtownNeighbors.id,
      },
      // Downtown Little Rock
      {
        type: "OFFER",
        title: "Free ESL conversation practice",
        description:
          "Native English speaker offering weekly conversation practice for anyone learning English. Meet at the downtown library on Thursday evenings. All levels welcome.",
        category: "Education",
        location: neighborhoods.downtown.location,
        latitude: neighborhoods.downtown.lat,
        longitude: neighborhoods.downtown.lng,
        urgency: "LOW",
        authorId: david.id,
        communityId: downtownCommunity.id,
        startAt: nextWeekdayAt(4, 18, 0),
        endAt: nextWeekdayAt(4, 20, 0),
        recurrenceFreq: "WEEK",
        recurrenceInterval: 1,
      },
      {
        type: "REQUEST",
        title: "Lost cat near Main Street",
        description:
          "My orange tabby, Mango, slipped out yesterday evening near Main and 3rd. He\u2019s friendly and wearing a blue collar. Please message me if you spot him!",
        category: "Other",
        location: neighborhoods.downtown.location,
        latitude: neighborhoods.downtown.lat,
        longitude: neighborhoods.downtown.lng,
        urgency: "HIGH",
        authorId: peter.id,
        communityId: downtownCommunity.id,
      },
      // Riverdale Community
      {
        type: "OFFER",
        title: "Tomato and pepper seedlings ready for pickup",
        description:
          "Started too many seeds this spring. I have about 20 tomato and 15 pepper seedlings free to good gardens. Varieties include Cherokee Purple, San Marzano, and Jalape\u00f1o.",
        category: "Other",
        location: neighborhoods.riverdale.location,
        latitude: neighborhoods.riverdale.lat,
        longitude: neighborhoods.riverdale.lng,
        urgency: "LOW",
        authorId: ursula.id,
        communityId: riverdaleCommunity.id,
      },
      {
        type: "REQUEST",
        title: "Looking for compost materials",
        description:
          "Our community garden compost bin is running low. If you have coffee grounds, leaves, or other compostable scraps, we\u2019d love to take them off your hands.",
        category: "Other",
        location: neighborhoods.riverdale.location,
        latitude: neighborhoods.riverdale.lat,
        longitude: neighborhoods.riverdale.lng,
        urgency: "MEDIUM",
        authorId: david.id,
        communityId: riverdaleCommunity.id,
      },
    ],
  });

  console.log("Seed data created:");
  console.log(`  Admin: ${admin.email}`);
  console.log(
    `  Users: ${emma.email}, ${peter.email}, ${david.email}, ${ursula.email}`,
  );
  console.log(
    `  Organizations: ${littleRockMutualAid.name}, ${foodNotBombs.name}, ${freeClinic.name}, ${capitolViewToolLibrary.name}, ${midtownChildcareCoop.name}, ${riverdaleRepairCafe.name}, ${meadowbrookPantry.name}`,
  );
  console.log(
    `  Communities: ${meadowbrookNeighbors.name}, ${quapawQuarterCommunity.name}, ${baselineCommunity.name}, ${capitolViewNeighbors.name}, ${midtownNeighbors.name}, ${downtownCommunity.name}, ${riverdaleCommunity.name}`,
  );
  console.log(
    "  14 public posts, 14 organization posts, 14 community posts created",
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
