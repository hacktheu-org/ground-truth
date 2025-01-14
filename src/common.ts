// Needed so that common.ts <-> schema.ts cyclical dependencies don't cause problems
/* tslint:disable:no-duplicate-imports */
import * as fs from "fs";
import * as crypto from "crypto";
import * as path from "path";

//
// Config
//
import { IConfig } from "./schema";
class Config implements IConfig.Main {
	public secrets: IConfig.Secrets = {
		adminKey: crypto.randomBytes(32).toString("hex"),
		session: crypto.randomBytes(32).toString("hex"),
		oauth: {
			github: {
				id: "",
				secret: ""
			},
			google: {
				id: "",
				secret: ""
			},
			facebook: {
				id: "",
				secret: ""
			}
		},
	};
	public email: IConfig.Email = {
		from: "HackGT Team <hello@hackgt.com>",
		key: "",
		headerImage: "",
		twitterHandle: "TheHackGT",
		facebookHandle: "thehackgt",
		contactAddress: "hello@hack.gt"
	};
	public server: IConfig.Server = {
		isProduction: false,
		port: 3000,
		versionHash: fs.existsSync(".git") ? require("git-rev-sync").short() : "",
		cookieMaxAge: 1000 * 60 * 60 * 24 * 30 * 6, // 6 months
		cookieSecureOnly: false,
		mongoURL: "mongodb://localhost/auth",
		passwordResetExpiration: 1000 * 60 * 60, // 1 hour
		defaultTimezone: "America/Denver",
		name: "HackGT",
		adminDomains: ["hack.gt"],
		admins: [],
	};
	public loginMethods = ["local"] as IConfig.Services[];
	protected addLoginMethod(method: IConfig.Services) {
		if (this.loginMethods.indexOf(method) === -1) {
			this.loginMethods.push(method);
		}
	}

	public sessionSecretSet: boolean = false;

	constructor(fileName: string = "config.json") {
		this.loadFromJSON(fileName);
		this.loadFromEnv();
	}
	protected loadFromJSON(fileName: string): void {
		// tslint:disable-next-line:no-shadowed-variable
		let config: IConfig.Main | null = null;
		try {
			config = JSON.parse(fs.readFileSync(path.resolve(__dirname, "./config", fileName), "utf8"));
		}
		catch (err) {
			if (err.code !== "ENOENT") {
				throw err;
			}
		}
		if (!config) {
			return;
		}
		if (config.secrets) {
			for (let key of Object.keys(config.secrets) as (keyof IConfig.Secrets)[]) {
				(this.secrets as any)[key] = config.secrets[key];
			}
		}
		if (config.secrets && config.secrets.session) {
			this.sessionSecretSet = true;
		}
		if (config.email) {
			for (let key of Object.keys(config.email) as (keyof IConfig.Email)[]) {
				this.email[key] = config.email[key];
			}
		}
		if (config.server) {
			for (let key of Object.keys(config.server) as (keyof IConfig.Server)[]) {
				(this.server as any)[key] = config.server[key];
			}
		}
		if (config.loginMethods) {
			this.loginMethods = config.loginMethods;
		}
	}
	protected loadFromEnv(): void {
		// Secrets
		if (process.env.ADMIN_KEY_SECRET) {
			this.secrets.adminKey = process.env.ADMIN_KEY_SECRET;
		}
		else {
			console.warn("Setting random admin key! Cannot use the service-to-service APIs.");
		}
		if (process.env.SESSION_SECRET) {
			this.secrets.session = process.env.SESSION_SECRET;
			this.sessionSecretSet = true;
		}
		if (process.env.GT_CAS) {
			this.addLoginMethod("gatech");
		}
		if (process.env.GITHUB_CLIENT_ID) {
			this.secrets.oauth.github.id = process.env.GITHUB_CLIENT_ID;
			this.addLoginMethod("github");
		}
		if (process.env.GITHUB_CLIENT_SECRET) {
			this.secrets.oauth.github.secret = process.env.GITHUB_CLIENT_SECRET;
		}
		if (process.env.GOOGLE_CLIENT_ID) {
			this.secrets.oauth.google.id = process.env.GOOGLE_CLIENT_ID;
			this.addLoginMethod("google");
		}
		if (process.env.GOOGLE_CLIENT_SECRET) {
			this.secrets.oauth.google.secret = process.env.GOOGLE_CLIENT_SECRET;
		}
		if (process.env.FACEBOOK_CLIENT_ID) {
			this.secrets.oauth.facebook.id = process.env.FACEBOOK_CLIENT_ID;
			this.addLoginMethod("facebook");
		}
		if (process.env.FACEBOOK_CLIENT_SECRET) {
			this.secrets.oauth.facebook.secret = process.env.FACEBOOK_CLIENT_SECRET;
		}
		// Email
		if (process.env.EMAIL_FROM) {
			this.email.from = process.env.EMAIL_FROM;
		}
		if (process.env.EMAIL_KEY) {
			this.email.key = process.env.EMAIL_KEY;
		}
		if (process.env.EMAIL_HEADER_IMAGE) {
			this.email.headerImage = process.env.EMAIL_HEADER_IMAGE;
		}
		if (process.env.EMAIL_TWITTER_HANDLE) {
			this.email.twitterHandle = process.env.EMAIL_TWITTER_HANDLE;
		}
		if (process.env.EMAIL_FACEBOOK_HANDLE) {
			this.email.facebookHandle = process.env.EMAIL_FACEBOOK_HANDLE;
		}
		if (process.env.EMAIL_CONTACT_ADDRESS) {
			this.email.contactAddress = process.env.EMAIL_CONTACT_ADDRESS;
		}
		// Server
		if (process.env.PRODUCTION && process.env.PRODUCTION.toLowerCase() === "true") {
			this.server.isProduction = true;
		}
		if (process.env.PORT) {
			let port = parseInt(process.env.PORT, 10);
			if (!isNaN(port) && port > 0) {
				this.server.port = port;
			}
		}
		if (process.env.VERSION_HASH) {
			this.server.versionHash = process.env.VERSION_HASH;
		}
		if (process.env.SOURCE_REV) {
			this.server.versionHash = process.env.SOURCE_REV;
		}
		if (process.env.SOURCE_VERSION) {
			this.server.versionHash = process.env.SOURCE_VERSION;
		}
		if (process.env.COOKIE_MAX_AGE) {
			let maxAge = parseInt(process.env.COOKIE_MAX_AGE, 10);
			if (!isNaN(maxAge) && maxAge > 0) {
				this.server.cookieMaxAge = maxAge;
			}
		}
		if (process.env.COOKIE_SECURE_ONLY && process.env.COOKIE_SECURE_ONLY.toLowerCase() === "true") {
			this.server.cookieSecureOnly = true;
		}
		if (process.env.MONGO_URL) {
			this.server.mongoURL = process.env.MONGO_URL;
		}
		if (process.env.DEFAULT_TIMEZONE) {
			this.server.defaultTimezone = process.env.DEFAULT_TIMEZONE;
		}
		if (process.env.NAME) {
			this.server.name = process.env.NAME;
		}
		if (process.env.PASSWORD_RESET_EXPIRATION) {
			let expirationTime = parseInt(process.env.PASSWORD_RESET_EXPIRATION, 10);
			if (!isNaN(expirationTime) && expirationTime > 0) {
				this.server.passwordResetExpiration = expirationTime;
			}
		}
		if (process.env.ADMIN_DOMAINS) {
			this.server.adminDomains = process.env.ADMIN_DOMAINS.split(",");
		}
		if (process.env.ADMINS) {
			this.server.admins = process.env.ADMINS.split(",");
		}
	}
}
export let config = new Config();

//
// Constants
//
export const PORT = config.server.port;
export const VERSION_NUMBER = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8")).version;
export const VERSION_HASH = config.server.versionHash;
export const COOKIE_OPTIONS = {
	"path": "/",
	"maxAge": config.server.cookieMaxAge,
	"secure": config.server.cookieSecureOnly,
	"httpOnly": true
};

//
// Database connection
//
import mongoose from "mongoose";
mongoose.connect(config.server.mongoURL, { useNewUrlParser: true }).catch(err => {
	throw err;
});
export { mongoose };

//
// Email
//
import sendgrid from "@sendgrid/mail";
sendgrid.setApiKey(config.email.key);
import marked from "marked";
// tslint:disable-next-line:no-var-requires
const striptags = require("striptags");
import { IUser } from "./schema";
import * as htmlToText from "html-to-text";
// tslint:disable-next-line:no-var-requires
const Email = require("email-templates");
const email = new Email({
	views: {
		root: path.resolve("src/emails/")
	},
	juice: true,
	juiceResources: {
		preserveImportant: true,
		webResources: {
			relativeTo: path.join(__dirname, "emails", "email-template")
		}
	}
});

export interface IMailObject {
	to: string;
	from: string;
	subject: string;
	html: string;
	text: string;
}
// Union types don't work well with overloaded method resolution in TypeScript so we split into two methods
export async function sendMailAsync(mail: IMailObject)  {
	return sendgrid.send(mail);
}
export function sanitize(input?: string): string {
	if (!input || typeof input !== "string") {
		return "";
	}
	return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatName(user: IUser): string {
	return `${user.name.preferred || user.name.first} ${user.name.last}`;
}

export function formatUsername(user: IUser): string {

	let hash = 0, i, chr, len;
	for (i = 0, len = user.uuid.length; i < len; i++) {
		chr = user.uuid.charCodeAt(i);
		hash = ((hash << 5) - hash) + chr;
		hash |= 0; // Convert to 32bit integer
	}

	let uniqueId = Math.abs(hash).toString();
	if(uniqueId.length > 5) {
		uniqueId = uniqueId.substring(0, 5);
	}

	return `${user.name.preferred || user.name.first}_${user.name.last}_${uniqueId}`;
}

let renderer = new marked.Renderer();
let singleLineRenderer = new marked.Renderer();
singleLineRenderer.link = (href, title, text) => `<a target=\"_blank\" href=\"${href}\" title=\"${title || ''}\">${text}</a>`;
singleLineRenderer.paragraph = (text) => text;
export async function renderMarkdown(markdown: string, options?: marked.MarkedOptions, singleLine: boolean = false): Promise<string> {
	let r = singleLine ? singleLineRenderer : renderer;
	return new Promise<string>((resolve, reject) => {
		marked(markdown, { sanitize: false, smartypants: true, renderer: r, ...options }, (err: Error | null, content: string) => {
			if (err) {
				reject(err);
				return;
			}
			resolve(content);
		});
	});
}
async function templateMarkdown(markdown: string, user: IUser): Promise<string> {
	markdown = markdown.replace(/{{email}}/g, sanitize(user.email));
	markdown = markdown.replace(/{{name}}/g, sanitize(formatName(user)));
	markdown = markdown.replace(/{{firstName}}/g, sanitize(user.name.first));
	markdown = markdown.replace(/{{preferredName}}/g, sanitize(user.name.preferred));
	markdown = markdown.replace(/{{lastName}}/g, sanitize(user.name.last));
	return markdown;
}
export async function renderEmailHTML(markdown: string, user: IUser): Promise<string> {
	markdown = await templateMarkdown(markdown, user);

	let renderedMarkdown = await renderMarkdown(markdown);
	return email.render("email-template/html", {
		emailHeaderImage: config.email.headerImage,
		twitterHandle: config.email.twitterHandle,
		facebookHandle: config.email.facebookHandle,
		emailAddress: config.email.contactAddress,
		hackathonName: config.server.name,
		body: renderedMarkdown
	});
}
export async function renderEmailText(markdown: string, user: IUser): Promise<string> {
	let templatedMarkdown = await templateMarkdown(markdown, user);
	let renderedHtml = await renderMarkdown(templatedMarkdown);
	return htmlToText.fromString(renderedHtml);
}
