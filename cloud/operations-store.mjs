import { rubricVersion, calculateAssessment } from "../config/rubrics.mjs";
import { staffTracks, ticketKinds } from "../config/community-roles.mjs";
export class OperationsStore {
  constructor(store) { this.store = store; }
  one(sql, ...args) { return this.store.one(sql,...args); }
  all(sql, ...args) { return this.store.all(sql,...args); }
  statement(sql,...args) { return this.store.statement(sql,...args); }
  async reserveTicket(user,kind,subject,detail) {
    if (!ticketKinds.includes(kind) || typeof subject !== "string" || subject.trim().length < 5 || subject.length > 100 || typeof detail !== "string" || detail.trim().length < 10 || detail.length > 1500) throw Error("Choose a ticket category, a 5–100 character subject and 10–1500 characters of detail. Never include passwords or tokens.");
    const id = crypto.randomUUID();
    const result = await this.statement("INSERT INTO support_tickets(id,user,kind,subject,detail,status,created) SELECT ?,?,?,?,?,'creating',? WHERE (SELECT count(*) FROM support_tickets WHERE user=? AND status IN ('creating','open','closing'))<2 AND NOT EXISTS(SELECT 1 FROM support_tickets WHERE user=? AND kind=? AND status IN ('creating','open','closing'))",id,user,kind,subject.trim(),detail.trim(),new Date().toISOString(),user,user,kind).run();
    if (!result.meta.changes) throw Error("You already have an active ticket in this category, or two active tickets. Use /ticket status.");
    return id;
  }
  async ticket(id) { return this.one("SELECT * FROM support_tickets WHERE id=?",id); }
  async ticketOpened(id,channel) { await this.statement("UPDATE support_tickets SET status='open',channel=? WHERE id=? AND status='creating'",channel,id).run(); }
  async ticketFailed(id) { await this.statement("UPDATE support_tickets SET status='failed' WHERE id=? AND status='creating'",id).run(); }
  async tickets(user,mod) { return this.all("SELECT * FROM support_tickets WHERE status IN ('creating','open','closing') AND (? IS NULL OR user=?) AND (?=1 OR kind<>'staff-report' OR user=?) ORDER BY created LIMIT 20",user??null,user??null,mod?1:0,user??null); }
  async claimTicket(id,actor) {
    const r = await this.statement("UPDATE support_tickets SET claimed_by=? WHERE id=? AND status='open' AND claimed_by IS NULL AND user<>?",actor,id,actor).run();
    if (!r.meta.changes) throw Error("Ticket is not open, is already claimed, or belongs to you.");
  }
  async closingTicket(id) { await this.statement("UPDATE support_tickets SET status='closing' WHERE id=? AND status IN ('open','closing')",id).run(); }
  async closedTicket(id,actor,reason) {
    this.store.reason(reason);
    await this.store.db.batch([this.statement("UPDATE support_tickets SET status='closed',closed=?,closed_by=?,close_reason=? WHERE id=? AND status='closing'",new Date().toISOString(),actor,reason,id),this.store.audit(actor,"ticket-close",id)]);
  }
  async applyStaff(user,track,experience,availability) {
    if (!staffTracks.includes(track)) throw Error("Choose helper, moderator, coach or event-host.");
    if (!await this.one("SELECT 1 FROM accounts WHERE discord=?",user)) throw Error("Verify Minecraft ownership with staff before applying.");
    if (typeof experience!=="string" || experience.trim().length<30 || experience.length>1500 || typeof availability!=="string" || availability.trim().length<10 || availability.length>300) throw Error("Include 30–1500 characters of experience and 10–300 characters of UTC availability.");
    const id=crypto.randomUUID();
    const r=await this.statement("INSERT INTO staff_applications(id,user,track,experience,availability,created) SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM staff_applications WHERE user=? AND track=? AND status='pending')",id,user,track,experience.trim(),availability.trim(),new Date().toISOString(),user,track).run();
    if(!r.meta.changes)throw Error("You already have a pending application for this role.");return id;
  }
  async applications(user) { return user ? this.all("SELECT id,track,status,decision,created FROM staff_applications WHERE user=? ORDER BY created DESC LIMIT 10",user) : this.all("SELECT * FROM staff_applications WHERE status='pending' ORDER BY created LIMIT 10"); }
  async reviewApplication(id,actor,decision,reason) {
    this.store.reason(reason); if(!["interview","declined"].includes(decision))throw Error("Choose interview or declined.");
    const r=await this.statement("UPDATE staff_applications SET status=?,reviewer=?,decision=? WHERE id=? AND status='pending' AND user<>?",decision,actor,reason.trim(),id,actor).run();
    if(!r.meta.changes)throw Error("A pending application and independent reviewer are required.");
  }
  async assess(id,actor,scores,rationale) {
    this.store.reason(rationale); const q=await this.one("SELECT * FROM queue WHERE id=? AND tester=? AND status='claimed'",id,actor);
    if(!q)throw Error("Only the assigned tester can assess an unfinished claimed test.");
    const assessment=calculateAssessment(q.mode,scores);
    const revision=crypto.randomUUID(),now=new Date().toISOString();
    const r=await this.store.db.batch([
      this.statement("INSERT INTO assessments(id,tester,mode,version,scores,total,rationale,created,revision) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM queue WHERE id=? AND tester=? AND status='claimed') ON CONFLICT(id) DO UPDATE SET tester=excluded.tester,scores=excluded.scores,total=excluded.total,rationale=excluded.rationale,created=excluded.created,revision=excluded.revision",id,actor,q.mode,rubricVersion,JSON.stringify(assessment.scores),assessment.total,rationale.trim(),now,revision,id,actor),
      this.statement("INSERT INTO assessment_history SELECT revision,id,tester,scores,total,rationale,created FROM assessments WHERE id=? AND revision=?",id,revision),
    ]);
    if(!r[0].meta.changes)throw Error("Assessment could not be saved; the claim may have changed.");
    return assessment;
  }
  async reviewPlacement(id,actor,tier,reason) {
    this.store.reason(reason); if(!/^(HT|LT)[1-2]$/.test(tier||""))throw Error("Senior sign-off is for HT1/LT1/HT2/LT2.");
    const r=await this.statement("INSERT INTO placement_reviews(review_id,id,reviewer,tier,reason,created,assessment_revision) SELECT ?,?,?,?,?,?,a.revision FROM queue q JOIN assessments a ON a.id=q.id WHERE q.id=? AND q.status='claimed' AND q.tester<>? AND q.user<>?",crypto.randomUUID(),id,actor,tier,reason.trim(),new Date().toISOString(),id,actor,actor).run();
    if(!r.meta.changes)throw Error("An assessed claim and independent senior reviewer are required.");
  }
  async warn(user,actor,reason) {
    this.store.reason(reason); if(!/^\d{5,22}$/.test(user||"")||user===actor)throw Error("Choose another server member.");
    const id=crypto.randomUUID(); await this.store.db.batch([this.statement("INSERT INTO moderation_cases(id,user,actor,reason,created) VALUES(?,?,?,?,?)",id,user,actor,reason.trim(),new Date().toISOString()),this.store.audit(actor,"warning-record",id)]);return id;
  }
  async cases(user) { return this.all("SELECT * FROM moderation_cases WHERE (? IS NULL OR user=?) ORDER BY created DESC LIMIT 10",user??null,user??null); }
  async resolveCase(id,actor,reason) { this.store.reason(reason);const r=await this.statement("UPDATE moderation_cases SET status='resolved',resolver=?,resolution=? WHERE id=? AND status='open'",actor,reason.trim(),id).run();if(!r.meta.changes)throw Error("No open moderation case found."); }
}
