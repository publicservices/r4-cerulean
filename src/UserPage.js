import React from "react";
import "./UserPage.css";
import Message from "./Message";
import { createPermalinkForTimelineEvent } from "./routing";

// UserPage renders an arbitrary user's timeline room. 
// Props:
//  - userId: The user's timeline room to view.
//  - withReplies: True to show replies in addition to posts.
//  - client: Client
class UserPage extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            loading: false,
            error: null,
            withReplies: this.props.withReplies,
            timeline: [],
            roomId: null,
            userProfile: null,
        };
    }

    async componentDidMount() {
        await this.loadEvents();
        this.listenForNewEvents();
    }

    listenForNewEvents(from) {
        let f = from;
        this.props.client
            .waitForMessageEventInRoom([this.state.roomId], from)
            .then((newFrom) => {
                f = newFrom;
                return this.loadEvents();
            })
            .then(() => {
                this.listenForNewEvents(f);
            });
    }

    async loadEvents() {
        if (this.state.loading) {
            return;
        }
        this.setState({
            loading: true,
        });
        // ensure we are following this user. In the future we can view without following
        // by using /peek but we don't have that for now.
        let roomId;
        try {
            roomId = await this.props.client.followUser(this.props.userId);
            this.loadProfile(); // don't block the UI by waiting for this

            this.setState({
                timeline: [],
                roomId: roomId,
            });
            await this.props.client.getTimeline(roomId, 100, (events) => {
                console.log("Adding ", events.length, " items");
                this.setState({
                    timeline: this.state.timeline.concat(events),
                    loading: false,
                });
            });
        } catch (err) {
            this.setState({
                error: JSON.stringify(err),
            });
        } finally {
            this.setState({
                loading: false,
            });
        }
    }

    async loadProfile() {
        try {
            const userProfile = await this.props.client.getProfile(
                this.props.userId
            );
            if (userProfile.avatar_url) {
                userProfile.avatar_url = this.props.client.thumbnailLink(
                    userProfile.avatar_url,
                    "scale",
                    64,
                    64
                );
            }
            this.setState({
                userProfile,
            });
        } catch (ex) {
            console.warn(
                `Failed to fetch user profile, might not be set yet`,
                ex
            );
        }
    }

    onPostsClick() {
        this.setState({
            withReplies: false,
        });
    }

    onPostsAndRepliesClick() {
        this.setState({
            withReplies: true,
        });
    }

    onReplied(parentEvent, eventId) {
        const link = createPermalinkForTimelineEvent(parentEvent);
        if (!link) {
            return;
        }
        window.location.href = link;
    }

    getMessages() {
	return this.state.timeline
            .filter((ev) => {
                // only messages sent by this user
                if (
                    ev.type !== "m.room.message" ||
                    ev.sender !== this.props.userId
                ) {
                    return false;
                }
                // only messages with cerulean fields
                if (
                    !ev.content["org.matrix.cerulean.event_id"]
                ) {
                    return false;
                }
                // all posts and replies
                if (this.state.withReplies) {
                    return true;
                }
                // only posts
                if (ev.content["org.matrix.cerulean.root"]) {
                    return true;
                }
                return false;
            })
    }
    onMessageClick(message) {
	const messages = this.getMessages()
        this.props.onPlay({
	    event: message,
	    events: messages,
	    source: this.state.userProfile
	})
    }

    render() {
        let timelineBlock;
        if (this.state.loading) {
                timelineBlock = <div className="loader">Loading posts...</div>;
        } else {
            let hasEntries = false;
            timelineBlock = (
                <div className="Messages">
                    {this.getMessages().map((ev) => {
                        hasEntries = true;
                        return (
                            <Message
                                key={ev.event_id}
                                event={ev}
                                isTimelineEvent={true}
                                onPost={this.onReplied.bind(this)}
				onClick={this.onMessageClick.bind(this)}
                            />
                        );
                    })}
                </div>
            );
            if (!hasEntries) {
                // the default page is / which is TimelinePage which then directs them to
                // their UserPage if there are no events, so we want to suggest some content
                let emptyListText;
                if (this.state.isMe) {
                    emptyListText = (
                        <span>
                            No posts yet.
                        </span>
                    );
                } else {
                    emptyListText = (
                        <span>This user hasn't posted anything yet.</span>
                    );
                }

                timelineBlock = (
                    <div className="emptyList">{emptyListText}</div>
                );
            }
        }

        let userPageHeader = (
                <div className="UserPageHeader">
                    <div className="userSection">
                        {this.state.userProfile?.avatar_url && (
                            <img
                                alt="User avatar"
                                className="userAvatar"
                                src={this.state.userProfile?.avatar_url}
                            ></img>
                        )}
                        <div className="userInfo">
                            {this.state.userProfile?.displayname && (
                                <div className="displayName">
                                    {this.state.userProfile?.displayname}
                                </div>
                            )}
                            <div className="userName">{this.props.userId}</div>
                        </div>
                    </div>
                </div>
            );

        let postTab = " tab";
        let postAndReplyTab = " tab";
        if (this.state.withReplies) {
            postAndReplyTab += " tabSelected";
        } else {
            postTab += " tabSelected";
        }

        let userPageBody = (
            <div>
                <div className="tabGroup display-none">
                    <span
                        className={postTab}
                        onClick={this.onPostsClick.bind(this)}
                    >
                        Posts
                    </span>
                    <span
                        className={postAndReplyTab}
                        onClick={this.onPostsAndRepliesClick.bind(this)}
                    >
                        Posts and replies
                    </span>
                </div>
                <div className=" UserPageBody">{timelineBlock}</div>
            </div>
        );

        return (
            <div className="UserPage">
                {userPageHeader}
                {userPageBody}
            </div>
        );
    }
}

export default UserPage;
