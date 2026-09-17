import { Link, useParams } from "react-router-dom";
import ConversationThread, {
  type ConversationViewer,
} from "../../components/conversations/ConversationThread";
import { getConversationInitiationReasonLabel } from "../../domain/conversations/conversations";
import {
  useConversationDetails,
  type ConversationDetailsProfile,
} from "../../hooks/conversations/useConversationDetails";
import { useAuth } from "../../providers/AuthProvider";

const classes = {
  page: "space-y-5",
  backLink: "backLink",
  stateCard: "card space-y-3 p-6",
  h1: "pageTitle",
  sub: "pageSub",
  loadingText: "text-sm text-zinc-500",
  errorNotice: "notice noticeError",
} as const;

const profileText = (
  profile: ConversationDetailsProfile | null,
  fallbackUserId: string
) => (profile?.handle ? `@${profile.handle}` : profile?.display_name ?? fallbackUserId);

const MessageDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, isLoading, error } = useConversationDetails(id ?? null);

  const conversation = data?.conversation ?? null;

  if (isLoading) {
    return (
      <div className={classes.stateCard}>
        <div className={classes.loadingText}>Loading conversation…</div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className={classes.stateCard}>
        <h1 className={classes.h1}>Conversation</h1>
        <div className={classes.errorNotice}>
          Conversation could not be loaded right now.
        </div>
      </div>
    );
  }

  const viewer: ConversationViewer =
    user?.id === conversation.buyer_user_id
      ? "buyer"
      : user?.id === conversation.creator_user_id
        ? "creator"
        : null;

  const buyerLabel = profileText(data?.buyer ?? null, conversation.buyer_user_id);
  const creatorLabel = profileText(data?.creator ?? null, conversation.creator_user_id);

  return (
    <div className={classes.page}>
      <Link to="/messages" className={classes.backLink}>
        ← Back to messages
      </Link>

      <ConversationThread
        conversation={conversation}
        viewer={viewer}
        buyerLabel={buyerLabel}
        creatorLabel={creatorLabel}
        header={
          <>
            <h1 className={classes.h1}>
              {data?.listing?.title ?? conversation.subject ?? "Conversation"}
            </h1>

            <p className={classes.sub}>
              Topic:{" "}
              {getConversationInitiationReasonLabel(conversation.initiation_reason_code)}
            </p>

            <p className={classes.sub}>
              Client: {buyerLabel} · Creator: {creatorLabel}
            </p>
          </>
        }
      />
    </div>
  );
};

// Remount per conversation so drafts and open forms never carry over to a different chat.
const MessageDetailsPage = () => {
  const { id } = useParams<{ id: string }>();

  return <MessageDetails key={id} />;
};

export default MessageDetailsPage;
