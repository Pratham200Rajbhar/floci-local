import { NextRequest, NextResponse } from "next/server";
import { getSESClient } from "@/lib/aws/clients";
import { handleAwsError } from "@/lib/aws/error-handler";
import { verifyEmailIdentitySchema } from "@/lib/validations/ses";
import {
  ListIdentitiesCommand,
  VerifyEmailIdentityCommand,
  DeleteIdentityCommand,
  GetIdentityVerificationAttributesCommand,
} from "@aws-sdk/client-ses";

export async function GET() {
  try {
    const ses = getSESClient();
    const listCmd = new ListIdentitiesCommand({ IdentityType: "EmailAddress" });
    const response = await ses.send(listCmd);

    const identities = response.Identities || [];
    let verificationAttributes: Record<string, { VerificationStatus?: string }> = {};

    if (identities.length > 0) {
      try {
        const attrCmd = new GetIdentityVerificationAttributesCommand({
          Identities: identities,
        });
        const attrRes = await ses.send(attrCmd);
        verificationAttributes = attrRes.VerificationAttributes || {};
      } catch {
        // Continue if verification attributes fail
      }
    }

    const items = identities.map((email) => ({
      email,
      status: verificationAttributes[email]?.VerificationStatus || "Success",
    }));

    return NextResponse.json({ identities: items, count: items.length });
  } catch (error) {
    return handleAwsError(error, "SES_LIST_IDENTITIES");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = verifyEmailIdentitySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: validation.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    const { emailAddress } = validation.data;
    const ses = getSESClient();
    const command = new VerifyEmailIdentityCommand({
      EmailAddress: emailAddress,
    });

    await ses.send(command);

    return NextResponse.json({
      success: true,
      emailAddress,
      message: `Verification initiated for ${emailAddress}`,
    });
  } catch (error) {
    return handleAwsError(error, "SES_VERIFY_IDENTITY");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const emailAddress = searchParams.get("emailAddress");

    if (!emailAddress) {
      return NextResponse.json(
        { error: { code: "ValidationError", message: "emailAddress parameter is required" } },
        { status: 400 }
      );
    }

    const ses = getSESClient();
    const command = new DeleteIdentityCommand({
      Identity: emailAddress,
    });

    await ses.send(command);

    return NextResponse.json({
      success: true,
      message: `Identity ${emailAddress} removed`,
    });
  } catch (error) {
    return handleAwsError(error, "SES_DELETE_IDENTITY");
  }
}
