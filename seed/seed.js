/**
 * Demo-data seeder.
 * Run with: node seed/seed.js
 *
 * Non-destructive: only seed-owned data is touched on re-run.
 *   - Users are upserted by email (real users, e.g. `afs@gmail.com`, are never
 *     deleted or overwritten)
 *   - Only seed campaigns (matched by their picsum.photos image-url pattern)
 *     are removed and re-inserted, along with their contributions
 *   - Only seed payments (matched by `seed-tx-*` transactionId) are replaced
 *
 * Shape produced:
 *   - 12 creators (role: 'creator', credits: 20)
 *   - 8  supporters (role: 'supporter', credits: 50, some have payment history)
 *   - 1  admin (role: 'admin')
 *   - 26 campaigns spread across creators, with a mix of approved / pending / rejected
 *   - Sample contributions + payments so the supporter home and admin stats aren't empty
 */
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

const categories = ['Technology', 'Art', 'Community', 'Health', 'Environment', 'Education'];

// ---------- 12 creators + 8 supporters + 1 admin ----------
const creators = [
  { name: 'Rakibul Hasan',     email: 'rakibul@example.com',   photoURL: '' },
  { name: 'Tanvir Ahmed',      email: 'tanvir@example.com',    photoURL: '' },
  { name: 'Sanjida Islam',     email: 'sanjida@example.com',   photoURL: '' },
  { name: 'Farhana Akter',     email: 'farhana@example.com',   photoURL: '' },
  { name: 'Imran Chowdhury',   email: 'imran@example.com',     photoURL: '' },
  { name: 'Nusrat Jahan',      email: 'nusrat@example.com',    photoURL: '' },
  { name: 'Mahmudul Karim',    email: 'mahmudul@example.com',  photoURL: '' },
  { name: 'Ayesha Siddiqua',   email: 'ayesha@example.com',    photoURL: '' },
  { name: 'Shafiqul Islam',    email: 'shafiqul@example.com',  photoURL: '' },
  { name: 'Rumana Khan',       email: 'rumana@example.com',    photoURL: '' },
  { name: 'Tareq Aziz',        email: 'tareq@example.com',     photoURL: '' },
  { name: 'Mahfuza Rahman',    email: 'mahfuza@example.com',   photoURL: '' },
];

const supporters = [
  { name: 'Asif Rahman',     email: 'asif@example.com' },
  { name: 'Mim Akter',       email: 'mim@example.com' },
  { name: 'Babul Mia',       email: 'babul@example.com' },
  { name: 'Tania Haque',     email: 'tania@example.com' },
  { name: 'Sabbir Hossain',  email: 'sabbir@example.com' },
  { name: 'Lamia Tabassum',  email: 'lamia@example.com' },
  { name: 'Jasim Uddin',     email: 'jasim@example.com' },
  { name: 'Rima Sultana',    email: 'rima@example.com' },
];

const adminUser = { name: 'Platform Admin', email: 'admin@example.com', photoURL: '' };

// ---------- 25 campaigns, each tied to a creator ----------
// status mix: 18 approved, 5 pending, 2 rejected
const campaignSeeds = [
  // Rakibul (3)
  { title: 'Solar-powered water pump for Rangpur village', creator: 'rakibul@example.com',
    story: 'Our village relies on diesel pumps that break down every monsoon season. This campaign funds a solar-powered pump that will provide clean water access to over 400 families, cutting fuel costs and downtime completely.',
    category: 'Community', goal: 800, min: 10, reward: 'Supporters receive a printed thank-you card and a spot on our village donor wall.', status: 'approved' },
  { title: 'Community mangrove restoration in Khulna', creator: 'rakibul@example.com',
    story: 'Replanting mangrove saplings along eroding riverbanks to rebuild a natural flood barrier and restore fish nursery habitat for local fishing communities.',
    category: 'Environment', goal: 1000, min: 10, reward: 'Your name attached to a planted sapling, with GPS coordinates.', status: 'approved' },
  { title: 'Flood-resistant seed bank for coastal farmers', creator: 'rakibul@example.com',
    story: 'Stocking salinated, drought-resistant seed varieties for 200 smallholder farmers in coastal districts so the next flood does not wipe out the year.',
    category: 'Environment', goal: 600, min: 8, reward: 'A seasonal harvest report from a farmer your seeds supported.', status: 'pending' },

  // Tanvir (3)
  { title: 'Open-source Bangla screen reader', creator: 'tanvir@example.com',
    story: 'We are building a free, open-source screen reader tailored for Bangla text, aimed at helping visually impaired students access digital textbooks for the first time in their native language.',
    category: 'Technology', goal: 1200, min: 15, reward: 'Early beta access, plus your name in the project credits.', status: 'approved' },
  { title: 'After-school coding club for girls', creator: 'tanvir@example.com',
    story: 'A free, twice-weekly coding club for girls aged 12-16 in underserved schools, covering the basics of web development and robotics with donated laptops.',
    category: 'Education', goal: 700, min: 10, reward: 'A handwritten thank-you note from one of the students.', status: 'approved' },
  { title: 'Low-cost Braille printer for university library', creator: 'tanvir@example.com',
    story: 'A Braille printer built from off-the-shelf parts so the central university library can convert digital textbooks for blind students on demand.',
    category: 'Education', goal: 1500, min: 20, reward: 'A demo print of the first chapter of a book you help convert.', status: 'rejected' },

  // Sanjida (2)
  { title: 'Mobile art studio for street children', creator: 'sanjida@example.com',
    story: 'A converted van filled with paint, canvases, and instructors that visits underprivileged neighborhoods twice a week, giving kids a creative outlet and a safe place to spend their afternoons.',
    category: 'Art', goal: 650, min: 5, reward: 'A digital print of artwork created during the program.', status: 'approved' },
  { title: 'Public mural series for Old Dhaka walls', creator: 'sanjida@example.com',
    story: 'Commissioning local artists to paint a series of murals celebrating Bangladeshi folk stories on otherwise-tagged walls in Old Dhaka.',
    category: 'Art', goal: 450, min: 5, reward: 'A high-res photo print of the finished mural you helped fund.', status: 'pending' },

  // Farhana (2)
  { title: 'Free eye-checkup camps in Sylhet', creator: 'farhana@example.com',
    story: 'Partnering with local optometrists to run monthly free eye-checkup camps, with subsidized glasses for anyone diagnosed with a correctable vision issue.',
    category: 'Health', goal: 900, min: 10, reward: 'Quarterly impact report showing exactly how many people were treated.', status: 'approved' },
  { title: 'Mental health helpline for teenagers', creator: 'farhana@example.com',
    story: 'A trained-counselor-staffed helpline and chat support for teenagers across Bangladesh, free of charge and confidential.',
    category: 'Health', goal: 1100, min: 12, reward: 'Stickers and a small booklet of self-care tips designed by teens, for teens.', status: 'approved' },

  // Imran (2)
  { title: 'Affordable prosthetic hands from recycled plastic', creator: 'imran@example.com',
    story: '3D-printing low-cost prosthetic hands from recycled PET bottles, fitted and tuned on-site for amputees who otherwise cannot afford one.',
    category: 'Health', goal: 850, min: 10, reward: 'A short documentary link showing the hand your support helped build.', status: 'approved' },
  { title: 'Drone-based crop monitoring for small farmers', creator: 'imran@example.com',
    story: 'A drone-and-phone service that flies over farms weekly and tells farmers exactly which plots need water or fertilizer, cutting input costs.',
    category: 'Technology', goal: 1300, min: 15, reward: 'A printed farm-health snapshot from one of the participating farms.', status: 'pending' },

  // Nusrat (2)
  { title: 'Rickshaw library reaching rural students', creator: 'nusrat@example.com',
    story: 'A converted rickshaw stacked with books that tours three villages each week, lending books to students who have no nearby library.',
    category: 'Education', goal: 400, min: 5, reward: 'A handwritten postcard from a student who borrowed a book that week.', status: 'approved' },
  { title: 'School meal program in Kurigram char', creator: 'nusrat@example.com',
    story: 'Hot, balanced midday meals for 150 primary-school students in river-erosion-prone char areas, many of whom walk miles to attend school.',
    category: 'Community', goal: 750, min: 8, reward: 'A photo and a short thank-you note from the students.', status: 'approved' },

  // Mahmudul (2)
  { title: 'Plastic-to-brick recycling workshop', creator: 'mahmudul@example.com',
    story: 'A small workshop that takes collected plastic waste and presses it into low-cost paving bricks for footpaths in low-income neighborhoods.',
    category: 'Environment', goal: 550, min: 6, reward: 'A brick with your name stamped into it, from your donation batch.', status: 'approved' },
  { title: 'River-cleaning solar catamaran', creator: 'mahmudul@example.com',
    story: 'A solar-powered catamaran that skims the Buriganga daily, collecting floating plastic before it can break down into microplastics.',
    category: 'Environment', goal: 2200, min: 25, reward: 'An invitation to a sunset launch run once we hit 50% of our goal.', status: 'rejected' },

  // Ayesha (2)
  { title: 'Women-led cooperative soap brand', creator: 'ayesha@example.com',
    story: 'A cooperative of 12 women producing natural herbal soaps, with training, branding, and the first year of packaging funded through this campaign.',
    category: 'Community', goal: 500, min: 5, reward: 'A bar of handmade soap shipped anywhere in Bangladesh.', status: 'approved' },
  { title: 'Free tailoring micro-loans for rural women', creator: 'ayesha@example.com',
    story: 'Small, zero-interest micro-loans plus sewing-machine access for 30 rural women to start home-based tailoring businesses.',
    category: 'Community', goal: 950, min: 10, reward: 'A hand-stitched thank-you bookmark from one of the loan recipients.', status: 'pending' },

  // Shafiqul (2)
  { title: 'Sports kit for under-14 cricket clubs', creator: 'shafiqul@example.com',
    story: 'Bats, pads, helmets, and balls for 10 neighborhood cricket clubs in Chattogram so kids do not have to share one battered kit between 30 players.',
    category: 'Community', goal: 350, min: 5, reward: 'A signed thank-you card from one of the teams.', status: 'approved' },
  { title: 'Public chess boards in five Dhaka parks', creator: 'shafiqul@example.com',
    story: 'Weatherproof concrete-and-stone chess tables installed in five busy Dhaka parks, with one free demo set at each table.',
    category: 'Community', goal: 280, min: 5, reward: 'A small enamel pin of the project logo.', status: 'pending' },

  // Rumana (2)
  { title: 'Heritage photo archive of old Dhaka', creator: 'rumana@example.com',
    story: 'Digitizing, captioning, and uploading 2000 archival photographs of Old Dhaka to a free, searchable online archive.',
    category: 'Art', goal: 600, min: 8, reward: 'A high-res print of any photo you pick from the archive.', status: 'approved' },
  { title: 'Children\'s book on Bangladeshi folk tales', creator: 'rumana@example.com',
    story: 'Illustrating and printing 5000 copies of a bilingual children\'s book collecting lesser-known folk tales from across the country.',
    category: 'Education', goal: 480, min: 6, reward: 'A copy of the finished book mailed to your address.', status: 'approved' },

  // Tareq (2)
  { title: 'Affordable hearing aids for tea-garden workers', creator: 'tareq@example.com',
    story: 'Fitting low-cost, durable hearing aids for tea-garden workers in Moulvibazar who have noise-induced hearing loss from decades of work.',
    category: 'Health', goal: 1700, min: 20, reward: 'A handwritten letter from one of the workers you helped.', status: 'approved' },
  { title: 'Open-source payroll tool for small NGOs', creator: 'tareq@example.com',
    story: 'A free, audited payroll and leave-management web tool purpose-built for small NGOs that cannot afford enterprise software.',
    category: 'Technology', goal: 800, min: 10, reward: 'Priority feature vote and your name in the project credits.', status: 'approved' },

  // Mahfuza (2)
  { title: 'STEM lab for girls in Rajshahi college', creator: 'mahfuza@example.com',
    story: 'Setting up a small, well-equipped STEM lab (microscopes, basic electronics, chemistry sets) in a government girls\' college that currently has none.',
    category: 'Education', goal: 1400, min: 15, reward: 'A photo of the lab dedication plaque with your name on it.', status: 'approved' },
  { title: 'After-school math tutoring for slum children', creator: 'mahfuza@example.com',
    story: 'Paid tutors running two-hour after-school math sessions five days a week for children in two major slum areas of Dhaka.',
    category: 'Education', goal: 320, min: 5, reward: 'A small thank-you card drawn by one of the students.', status: 'approved' },
];

async function seed() {
  await client.connect();
  const db = client.db('crowdfundHubDB');
  const usersCollection = db.collection('users');
  const campaignsCollection = db.collection('campaigns');
  const contributionsCollection = db.collection('contributions');
  const paymentsCollection = db.collection('payments');

  // ---- Users: upsert by email so real registered users are never touched ----
  // Existing seed users (if any) get refreshed; brand-new ones get inserted.
  // Anyone else in the collection (e.g. `afs@gmail.com`) is left alone.
  const allSeedUsers = [
    ...creators.map((c) => ({ ...c, role: 'creator', credits: 20 })),
    ...supporters.map((s) => ({ ...s, photoURL: '', role: 'supporter', credits: 50 })),
    { ...adminUser, role: 'admin', credits: 0 },
  ];
  let usersInserted = 0;
  let usersUpdated = 0;
  for (const u of allSeedUsers) {
    const result = await usersCollection.updateOne(
      { email: u.email },
      {
        $set: { name: u.name, role: u.role, credits: u.credits, photoURL: u.photoURL || '' },
        $setOnInsert: { email: u.email, createdAt: new Date() },
      },
      { upsert: true },
    );
    if (result.upsertedCount) usersInserted += 1;
    else if (result.modifiedCount) usersUpdated += 1;
  }
  console.log(`✅ Users: ${usersInserted} new, ${usersUpdated} refreshed (${allSeedUsers.length} seed users total — real users untouched)`);

  // ---- Campaigns: identify and remove only the previous seed batch ----
  // Marker: the picsum URL we mint below. Real campaigns uploaded by users
  // never carry this image pattern, so they survive the delete.
  const seedImagePattern = /^https:\/\/picsum\.photos\/seed\/campaign-\d+\/800\/500$/;
  const oldSeedCampaigns = await campaignsCollection.find({ campaign_image_url: { $regex: seedImagePattern.source } }).toArray();
  const oldSeedIds = oldSeedCampaigns.map((c) => c._id.toString());

  if (oldSeedIds.length) {
    // Pull contributions attached to those seed campaigns BEFORE we delete,
    // so we can clean them up too (otherwise they'd orphan with a dead campaign_id).
    await contributionsCollection.deleteMany({ campaign_id: { $in: oldSeedIds } });
    await campaignsCollection.deleteMany({ _id: { $in: oldSeedCampaigns.map((c) => c._id) } });
    console.log(`🧹 Cleared ${oldSeedIds.length} previous seed campaigns (and their contributions)`);
  }

  // ---- Campaigns ----
  // Spread deadlines across 20-90 days from now, and amount_raised across 0-70% of the goal
  // so the Explore page and Admin Home have realistic numbers.
  const creatorByEmail = Object.fromEntries(creators.map((c) => [c.email, c]));
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  // We need the real ObjectId for each inserted campaign so that contributions
  // can reference it (contributionRoutes.js does ObjectId(campaign_id) on approve).
  // So we insert campaigns first, then build contributions from the returned docs.
  const baseCampaignDocs = campaignSeeds.map((c, i) => ({
    campaign_title: c.title,
    campaign_story: c.story,
    category: c.category,
    funding_goal: c.goal,
    minimum_contribution: c.min,
    deadline: new Date(now + (20 + (i % 8) * 9) * day).toISOString().slice(0, 10),
    reward_info: c.reward,
    creator_name: creatorByEmail[c.creator].name,
    creator_email: c.creator,
    campaign_image_url: `https://picsum.photos/seed/campaign-${i + 1}/800/500`,
    amount_raised: 0,  // updated below after we sum real approved contributions
    status: c.status,
    createdAt: new Date(now - (i % 10) * day),
  }));
  const campaignResult = await campaignsCollection.insertMany(baseCampaignDocs);
  console.log(`✅ Seeded ${campaignResult.insertedCount} campaigns`);

  // Map: index in baseCampaignDocs -> real ObjectId
  const campaignIds = Object.values(campaignResult.insertedIds);
  const insertedCampaigns = baseCampaignDocs.map((c, i) => ({ ...c, _id: campaignIds[i] }));

  // ---- Contributions: only for approved campaigns ----
  // Mix of pending and approved so the creator home + supporter home have data.
  const approvedCampaigns = insertedCampaigns.filter((c) => c.status === 'approved');
  const contributionDocs = [];
  approvedCampaigns.forEach((camp, idx) => {
    // 2-4 contributions per approved campaign
    const count = 2 + (idx % 3);
    for (let k = 0; k < count; k += 1) {
      const supporter = supporters[(idx + k) % supporters.length];
      const amount = camp.minimum_contribution * (1 + ((idx + k) % 5));
      contributionDocs.push({
        campaign_id: camp._id.toString(),
        campaign_title: camp.campaign_title,
        contribution_amount: amount,
        supporter_email: supporter.email,
        supporter_name: supporter.name,
        creator_email: camp.creator_email,
        creator_name: camp.creator_name,
        current_date: new Date(now - ((idx + k) % 14) * day),
        status: k === 0 && idx % 2 === 0 ? 'pending' : 'approved',
      });
    }
  });
  if (contributionDocs.length) {
    const cResult = await contributionsCollection.insertMany(contributionDocs);
    console.log(`✅ Seeded ${cResult.insertedCount} contributions`);
  }

  // ---- Payments: replace only seed-tagged ones ----
  // Marker: transactionId starting with `seed-tx-`. Real Stripe payments from
  // supporters use a real `pi_...` id and are never touched.
  await paymentsCollection.deleteMany({ transactionId: { $regex: /^seed-tx-/ } });
  const paymentDocs = [];
  supporters.slice(0, 5).forEach((s, i) => {
    paymentDocs.push({
      email: s.email,
      price: 10 + i * 5,
      credits: 50 + i * 25,
      transactionId: `seed-tx-${i + 1}`,
      date: new Date(now - i * 2 * day),
    });
  });
  if (paymentDocs.length) {
    const pResult = await paymentsCollection.insertMany(paymentDocs);
    console.log(`✅ Seeded ${pResult.insertedCount} payments`);
  }

  // ---- Reflect approved contributions back into campaigns.amount_raised ----
  // (Idempotent: we set, not $inc, so re-running gives the same total.)
  const sumByCampaign = {};
  contributionDocs
    .filter((c) => c.status === 'approved')
    .forEach((c) => {
      sumByCampaign[c.campaign_id] = (sumByCampaign[c.campaign_id] || 0) + c.contribution_amount;
    });
  for (const [cid, raised] of Object.entries(sumByCampaign)) {
    await campaignsCollection.updateOne(
      { _id: new ObjectId(cid) },
      { $set: { amount_raised: raised } },
    );
  }

  await client.close();
  console.log('\n🎉 Seed complete.');
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
