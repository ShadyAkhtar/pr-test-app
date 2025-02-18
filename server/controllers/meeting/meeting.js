const MeetingHistory = require("../../model/schema/meeting");
const mongoose = require("mongoose");
const User = require("../../model/schema/user");

// Author : @ShadyAkhtar

/**
 * * Create a new meeting history record
 * @param {Object} req - Request Object containing the meeting details
 * @param {Object} res - Response Object for sending the HTTP response
 * @returns {Object} - Returns the created meeting history record
 * @throws {Object} - Returns an error object with the error message
 */
const add = async (req, res) => {
  try {
    // Create a new meeting history record
    const result = new MeetingHistory(req.body);
    await result.save();
    res.status(200).json(result);
  } catch (err) {
    console.error("Failed to create :", err);
    res.status(400).json({ err, error: "Failed to create" });
  }
};

/**
 * * Fetch all meeting history records
 * @param {Object} req - Request Object containing the query parameters
 * @param {Object} res - Response Object for sending the HTTP response
 * @returns {Object} - Returns an array of meeting history records
 * @throws {Object} - Returns an error object with the error message
 */

const index = async (req, res) => {
  // fileds to be returned
  /**
   * * _id
   * * agenda - Agenda
   * * dateTime - Date & Time
   * * timestamp - Time Stamp
   * * createdByName - Create By
   */

  // Parse query and add filters
  let query = req.query;
  query.deleted = false; // Make sure deleted meetings aren't returned

  // Fetch user and filter based on their role
  const user = await User.findById(req.user.userId);
  if (user?.role !== "superAdmin") {
    // If the user is not a superAdmin, they can only see their created meetings
    query.createBy = mongoose.Types.ObjectId(req.user.userId); // Filter by userId
  }

  try {
    const result = await MeetingHistory.aggregate([
      // Match the query filters for the meeting
      { $match: query },

      // Lookup for the associated user who created the meeting
      {
        $lookup: {
          from: "User",
          localField: "createBy",
          foreignField: "_id",
          as: "createdByData",
        },
      },

      // Unwind the createBy data
      { $unwind: { path: "$createdByData", preserveNullAndEmptyArrays: true } },

      // Add a field `createdByName` which combines the first and last name of the user
      {
        $addFields: {
          createdByName: {
            $concat: [
              "$createdByData.firstName",
              " ",
              "$createdByData.lastName",
            ],
          },
        },
      },

      // Project the required fields: _id, agenda, dateTime, timestamp, createdByName
      {
        $project: {
          _id: 1,
          agenda: 1,
          dateTime: 1,
          timestamp: 1,
          createdByName: 1, // This includes the concatenated name of the creator
        },
      },
    ]);

    // Send the result as a response
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching meeting history:", error);
    res.status(500).send("Internal Server Error");
  }
};

/**
 * * Fetch a single meeting history record by its ID
 * @param {Object} req - Request Object (query params) containing the meeting ID
 * @param {*} res - Response Object for sending the HTTP response
 * @returns {Object} - Returns the meeting details
 * @throws {Object} - Returns an error object with the error message
 */

const view = async (req, res) => {
  /**
   * * Field to return for Meeting view
   * * _id
   * * agenda - Agenda
   * * dateTime - Date & Time
   * * timestamp - Time Stamp
   * * createdByName - Create By
   * * location - Location
   * * attendes - Attendes (ref: Contact)
   * * notes - Notes
   */

  try {
    // Fetch the meeting by its ID
    let response = await MeetingHistory.findOne({ _id: req.params.id });
    if (!response)
      return res.status(404).json({ message: "No meeting found." });

    // Use aggregation to fetch related data and process the fields we need
    let result = await MeetingHistory.aggregate([
      { $match: { _id: response._id } },

      // Lookup the associated "User" who created the meeting
      {
        $lookup: {
          from: "User",
          localField: "createBy",
          foreignField: "_id",
          as: "createdByData",
        },
      },

      { $unwind: { path: "$createdByData", preserveNullAndEmptyArrays: true } },

      // Lookup the attendees from the "Contact" collection
      {
        $lookup: {
          from: "Contacts",
          localField: "attendes", // Array of ObjectIds of attendees
          foreignField: "_id",
          as: "attendesData", // Store matched attendees here
        },
      },

      // Unwind the attendees data
      { $unwind: { path: "$attendesData", preserveNullAndEmptyArrays: true } },

      //   Add fields for user names and attendee names
      {
        $addFields: {
          createdByName: {
            $concat: [
              { $toString: "$createdByData.firstName" },
              " ",
              { $toString: "$createdByData.lastName" },
            ], // Combine first and last name
          },
          // Attendees' names as an array of concatenated names
          attendesNames: {
            $map: {
              input: "$attendesData",
              as: "attendee",
              in: {
                $concat: [
                  { $toString: "$$attendee.firstName" },
                  " ",
                  { $toString: "$$attendee.lastName" },
                ],
              },
            },
          },
        },
      },

      // Project the required fields
      {
        $project: {
          _id: 1,
          agenda: 1,
          dateTime: 1,
          timestamp: 1,
          createdByName: 1,
          location: 1,
          attendesNames: 1, // Only return the names of the attendees
          notes: 1,
        },
      },
    ]);

    // Check if result is empty, and return a 404 if no meeting was found
    if (!result.length) {
      return res
        .status(404)
        .json({ message: "No data found for this meeting." });
    }

    // Return the response with the meeting details and attendees
    res.status(200).json(result[0]);
  } catch (err) {
    console.error("Error fetching meeting details:", err);
    res.status(400).json({ error: err.message });
  }
};

/**
 * * Delete a meeting history record by its ID
 * @param {Object} req - Request Object containing the meeting ID
 * @param {Object} res - Response Object for sending the HTTP response
 * @returns {Object} - Returns a success message
 * @throws {Object} - Returns an error object with the error message
 */

const deleteData = async (req, res) => {
  try {
    // Find the meeting by ID and update the 'deleted' field to true
    const result = await MeetingHistory.findByIdAndUpdate(req.params.id, {
      deleted: true,
    });

    // Return a success response
    res.status(200).json({ message: "Meeting deleted successfully", result });
  } catch (err) {
    console.error("Failed to delete meeting:", err);
    res.status(400).json({ error: "Failed to delete meeting" });
  }
};

/**
 * * Delete multiple meeting history records by their IDs
 * @param {Object} req - Request Object containing an array of meeting IDs
 * @param {Object} res - Response Object for sending the HTTP response
 * @returns {Object} - Returns a success message
 * @throws {Object} - Returns an error object with the error message
 */
const deleteMany = async (req, res) => {
  try {
    // Find all the meetings by their IDs and update the 'deleted' field to true
    const result = await MeetingHistory.updateMany(
      { _id: { $in: req.body } },
      { $set: { deleted: true } }
    );

    // Return a success response
    res.status(200).json({ message: "Meetings deleted successfully", result });
  } catch (err) {
    console.error("Failed to delete meetings:", err);
    res.status(400).json({ error: "Failed to delete meetings" });
  }
};

module.exports = { add, index, view, deleteData, deleteMany };
