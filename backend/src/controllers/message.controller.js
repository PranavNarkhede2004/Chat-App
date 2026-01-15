import User from "../models/user.model.js";
import Message from "../models/message.model.js";

import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const user = await User.findById(loggedInUserId).populate('friends', '-password');
    const filteredUsers = user.friends;

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const addFriend = async (req, res) => {
  try {
    const { email } = req.body;
    const loggedInUserId = req.user._id;

    const friend = await User.findOne({ email });
    if (!friend) {
      return res.status(404).json({ error: "User not found" });
    }

    if (friend._id.toString() === loggedInUserId.toString()) {
      return res.status(400).json({ error: "Cannot add yourself as friend" });
    }

    const user = await User.findById(loggedInUserId);
    if (user.friends.includes(friend._id)) {
      return res.status(400).json({ error: "Already friends" });
    }

    user.friends.push(friend._id);
    await user.save();

    res.status(200).json({ message: "Friend added successfully", friend: { _id: friend._id, fullName: friend.fullName, email: friend.email, profilePic: friend.profilePic } });
  } catch (error) {
    console.error("Error in addFriend: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl;
    if (image) {
      // Upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    await newMessage.save();

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
