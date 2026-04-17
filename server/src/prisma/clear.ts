import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Delete in order to respect foreign key constraints
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.report.deleteMany();
  await prisma.postFulfillment.deleteMany();
  await prisma.postImage.deleteMany();
  await prisma.post.deleteMany();
  await prisma.community.deleteMany();
  await prisma.communityInvite.deleteMany();
  await prisma.communityJoinRequest.deleteMany();
  await prisma.communityMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.organizationInvite.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.user.deleteMany();

  console.log("All data cleared.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
