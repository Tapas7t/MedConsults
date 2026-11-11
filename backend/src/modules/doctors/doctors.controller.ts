import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { DoctorProfile } from '../../models/DoctorProfile.js';
import { Availability } from '../../models/Availability.js';
import { Appointment } from '../../models/Appointment.js';
import { Block } from '../../models/Block.js';
import { generateDoctorSlots } from '../../utils/slots.js';
import { parseLocalToUtc } from '../../utils/time.js';

export async function getDoctorsDirectory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { q, specialty, city, type, minFee, maxFee, page = 1, limit = 10 } = req.query as any;

    const query: Record<string, any> = {
      status: 'approved',
      listedInDirectory: true,
      isDeleted: false,
    };

    if (type) {
      query.type = type;
    }

    if (specialty) {
      query.specialty = { $regex: new RegExp(specialty, 'i') };
    }

    if (city) {
      query['clinic.city'] = { $regex: new RegExp(city, 'i') };
    }

    if (minFee !== undefined || maxFee !== undefined) {
      query.fee = {};
      if (minFee !== undefined) query.fee.$gte = Number(minFee);
      if (maxFee !== undefined) query.fee.$lte = Number(maxFee);
    }

    if (q) {
      query.$text = { $search: q };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [doctors, total] = await Promise.all([
      DoctorProfile.find(query)
        .select('-licenceNo')
        .sort(q ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      DoctorProfile.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: doctors,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getDoctorBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawSlug = req.params.slug;
    const slug = (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug)?.toLowerCase();
    const doctor = await DoctorProfile.findOne({
      slug,
      status: 'approved',
      isDeleted: false,
    }).select('-licenceNo');

    if (!doctor) {
      res.status(404).json({
        success: false,
        error: {
          code: 'DOCTOR_NOT_FOUND',
          message: 'The requested doctor page was not found or is currently not active',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: doctor,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDoctorSlots(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const { from, to } = req.query as any;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Doctor not found' },
      });
      return;
    }

    const doctor = await DoctorProfile.findOne({
      _id: id,
      status: 'approved',
      isDeleted: false,
    });

    if (!doctor) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Doctor not found or not active' },
      });
      return;
    }

    const availability = await Availability.findOne({ doctorId: doctor._id });

    // Determine list of local dates to calculate
    const startDate = new Date(from);
    const endDate = to ? new Date(to) : new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000); // Default 7 days window

    const dateStrings: string[] = [];
    const curr = new Date(startDate);
    // Limit to max 14 days per request to maintain < 500ms p95 response time
    let daysCount = 0;
    while (curr <= endDate && daysCount < 14) {
      dateStrings.push(curr.toISOString().split('T')[0]!);
      curr.setDate(curr.getDate() + 1);
      daysCount++;
    }

    if (dateStrings.length === 0) {
      res.status(200).json({ success: true, data: [] });
      return;
    }

    // Convert date bounds to UTC for query
    const timeZone = doctor.clinic.timezone || 'Asia/Kolkata';
    const queryStartUtc = parseLocalToUtc(dateStrings[0]!, '00:00', timeZone);
    const queryEndUtc = parseLocalToUtc(dateStrings[dateStrings.length - 1]!, '23:59', timeZone);

    // Fetch existing active appointments and blocks within this window
    const [appointments, blocks] = await Promise.all([
      Appointment.find({
        doctorId: doctor._id,
        status: { $in: ['pending', 'confirmed', 'arrived'] },
        isDeleted: false,
        startAt: { $gte: queryStartUtc, $lte: queryEndUtc },
      }),
      Block.find({
        doctorId: doctor._id,
        startAt: { $lte: queryEndUtc },
        endAt: { $gte: queryStartUtc },
      }),
    ]);

    const slots = generateDoctorSlots({
      doctor,
      availability,
      appointments,
      blocks,
      dateStrings,
    });

    res.status(200).json({
      success: true,
      data: slots,
    });
  } catch (error) {
    next(error);
  }
}
