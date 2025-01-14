import * as fs from "fs";
import * as path from "path";
import * as express from "express";
import * as Handlebars from "handlebars";

import { config, formatName } from "./common";
import { authenticateWithRedirect, isAdmin } from "./middleware";
import { TemplateContent, User, IUser, OAuthClient, AccessToken, Scope } from "./schema";
import { bestLoginMethod } from "./api";

// tslint:disable-next-line:no-any
// tslint:disable:no-invalid-this
Handlebars.registerHelper("ifCond", function (this: any, v1: any, v2: any, options: any) {
	if (v1 === v2) {
		return options.fn(this);
	}
	return options.inverse(this);
});
Handlebars.registerHelper("ifIn", function <T>(this: any, elem: T, list: T[], options: any) {
	if (list.includes(elem)) {
		return options.fn(this);
	}
	return options.inverse(this);
});
Handlebars.registerHelper("attr", (name: string, value: string): string => {
	if (value) {
		value = value.replace(/"/g, "&quot;");
		return `${name}="${value}"`;
	}
	else {
		return "";
	}
});
Handlebars.registerHelper("join", <T>(arr: T[]): string => {
	return arr.join(", ");
});
Handlebars.registerHelper("formatName", (name: { first: string; preferred: string; last: string; }): string => {
	return formatName({ name } as IUser);
})
if (config.server.isProduction) {
	Handlebars.registerPartial("main", fs.readFileSync(path.resolve("src/ui", "partials", "main.hbs"), "utf8"));
}

export class Template<T extends TemplateContent> {
	private template: Handlebars.TemplateDelegate<T> | null = null;

	constructor(private file: string) {
		this.loadTemplate();
	}

	private loadTemplate(): void {
		let data = fs.readFileSync(path.resolve("src/ui", this.file), "utf8");
		this.template = Handlebars.compile(data);
	}

	public render(input: Partial<T>): string {
		if (!config.server.isProduction) {
			Handlebars.registerPartial("main", fs.readFileSync(path.resolve("src/ui", "partials", "main.hbs"), "utf8"));
			this.loadTemplate();
		}
		const renderData = {
			siteTitle: config.server.name,
			contactEmail: config.email.contactAddress,
			includeJS: null,
			...input
		} as T;
		return this.template!(renderData);
	}
}

const IndexTemplate = new Template("index.hbs");
const LoginTemplate = new Template("login.hbs");
const ForgotPasswordTemplate = new Template("forgotpassword.hbs");
const ResetPasswordTemplate = new Template("resetpassword.hbs");
const ChangePasswordTemplate = new Template("changepassword.hbs");
const AdminTemplate = new Template("admin.hbs");

export let uiRoutes = express.Router();

uiRoutes.route("/js/login.js").get((request, response) => {
	response.type("js");
	fs.createReadStream(path.resolve("src/ui", "login.js")).pipe(response);
});
uiRoutes.route("/js/admin.js").get((request, response) => {
	response.type("js");
	fs.createReadStream(path.resolve("src/ui", "admin.js")).pipe(response);
});
uiRoutes.route("/css/login.css").get((request, response) => {
	response.type("css");
	fs.createReadStream(path.resolve("src/ui", "login.css")).pipe(response);
});

uiRoutes.route("/").get(authenticateWithRedirect, async (request, response) => {
	if (request.session) {
		let url = request.session.returnTo;
		if (url && url !== "/") {
			request.session.returnTo = undefined;
			response.redirect(url);
			return;
		}
	}
	let templateData = {
		title: "Home",

		user: request.user,
		loginMethod: await bestLoginMethod(request.user.email),
	};
	response.send(IndexTemplate.render(templateData));
});

uiRoutes.route("/login").get(async (request, response) => {
	if (request.isAuthenticated() && request.user && (request.user as IUser).verifiedEmail) {
		response.redirect("/");
		return;
	}
	let templateData = {
		title: "Log in",
		includeJS: "login",

		error: request.flash("error"),
		success: request.flash("success"),
		loginMethods: config.loginMethods,
		localOnly: config.loginMethods && config.loginMethods.length === 1 && config.loginMethods[0] === "local",
		email: request.session ? request.session.email : null,
	};
	response.send(LoginTemplate.render(templateData));
});

uiRoutes.route("/login/forgot").get((request, response) => {
	let templateData = {
		title: "Forgot Password",

		error: request.flash("error"),
		success: request.flash("success")
	};
	response.send(ForgotPasswordTemplate.render(templateData));
});
uiRoutes.route("/login/forgot/:code").get(async (request, response) => {
	let user = await User.findOne({ "local.resetCode": request.params.code });
	if (!user) {
		request.flash("error", "Invalid password reset code");
		response.redirect("/login");
		return;
	}
	else if (!user.local || !user.local.resetCode || Date.now() - user.local.resetRequestedTime!.valueOf() > config.server.passwordResetExpiration) {
		request.flash("error", "Your password reset link has expired. Please request a new one.");
		if (user.local) {
			user.local.resetCode = undefined;
		}
		await user.save();
		response.redirect("/login");
		return;
	}
	let templateData = {
		title: "Reset Password",

		error: request.flash("error"),
		success: request.flash("success"),
		resetCode: user.local!.resetCode!
	};
	response.send(ResetPasswordTemplate.render(templateData));
});
uiRoutes.route("/login/changepassword").get(authenticateWithRedirect, async (request, response) => {
	const user = request.user as IUser;
	if (!user.local || !user.local.hash) {
		response.redirect("/");
		return;
	}
	let templateData = {
		title: "Change Password",

		error: request.flash("error"),
		success: request.flash("success")
	};
	response.send(ChangePasswordTemplate.render(templateData));
});

uiRoutes.route("/admin").get(isAdmin, async (request, response) => {
	let templateData = {
		title: "Admin",
		includeJS: "admin",

		uuid: request.user.uuid,

		apps: await Promise.all((await OAuthClient.find()).map(async client => {
			let tokens = await AccessToken.countDocuments({ clientID: client.clientID });
			(client as any).tokens = tokens;
			return client;
		})),

		scopes: await Scope.find(),

		adminDomains: config.server.adminDomains,
		admins: config.server.admins,
		currentAdmins: await User.find({ admin: true }).sort("name.last")
	};
	response.send(AdminTemplate.render(templateData));
});
